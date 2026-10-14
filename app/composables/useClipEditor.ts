// The video editor (its own page, /videos/:id/editor): trim/crop/scale a
// range of a video, split it into segments, or edit its sound — all run as
// EDIT jobs (useVideoEdits), producing clips to preview, then promote (TRIM
// and AUDIO replace the video's file; SPLIT segments become new videos),
// download (extracted audio) or discard. Polls jobs
// while any are active, same pattern as VideoDownloadModal.
//
// Its state and actions live here, shared by VideoClipEditor.vue and its tab components
// (app/components/clip-editor/*), which inject them with useClipEditorContext().
import type { BurnedCaptions } from '~/composables/useOverlayEdit'
import type { InjectionKey } from 'vue'
import type { EditOverview, VideoClip } from '~/composables/useVideoEdits'
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import type { Video } from '~/composables/useVideos'
import type VideoPlayer from '~/components/VideoPlayer.vue'
import {
  boundaryAfter,
  centeredCrop,
  findSplitTarget,
  MAX_QUEUED_EDITS,
  NO_ORIENTATION,
  swapsSides,
  describeOrientation,
  hasOrientation,
  orientationRequest,
  type Orientation,
  safeInsets,
  MAX_SEGMENTS,
  MIN_TRIM_MS,
  maxEvenParts,
  moveBoundary,
  splitEveryRows,
  splitEvenlyRows,
  splitRowAt,
  uncoveredMs as uncoveredTime,
  validateCrop,
  validateScale,
  pictureBeforeResize,
  resizeChoices,
  keepShapeSize,
  resizeNotes,
  validateSegments,
  suggestedNewTitle,
  validateTrim,
  withTrimEdge
} from '#shared/utils/videoEdit'
import { musicPositionAt, previewGainAt } from '#shared/utils/audioEdit'
import { formatTimecode, parseTimecode } from '#shared/utils/transport'
import { presetFromSettings, ratioLabel } from '#shared/utils/exportPreset'
import { PLAIN_LOOK, cssFilter, describeVideoLook, isPlainLook, lookRequest, validateLook, type VideoLook } from '#shared/utils/videoLook'
import { CLIP_OPERATION_ICONS, clipLabel } from '#shared/utils/editResults'
import { describeExtras, extrasProblem, extrasRequest, isPlainExtras, sanitizeExtras, type TrimExtras } from '#shared/utils/trimExtras'
import { PLAIN_MOTION, describeMotion, isPlainMotion, motionProblem, motionRequest, sanitizeMotion, type VideoMotion } from '#shared/utils/videoMotion'
import { describeTrimAudio, trimAudioRequest, validateTrimAudio, type TrimAudioSettings } from '#shared/utils/trimAudio'
import { cutSkipTarget, mergeCutRanges, validateCutOut, type CutRange } from '#shared/utils/cutOut'
import { audioDifferences, fullAudio, isRecipeEmpty, type EditRecipe, type RecipeLayer } from '#shared/utils/editRecipe'
import { MAX_NAMED_ENTRIES, uniqueName } from '#shared/utils/namedList'
import { formatFileSize } from '#shared/utils/format'
import type { EditorDraft } from '~/composables/useEditorHistory'

export interface ClipEditorProps {
  video: Video
  canWrite: boolean
}
export interface ClipEditorEmit {
  (e: 'replaced'): void
  (e: 'created', videoId: number): void
}

export function useClipEditor(props: ClipEditorProps, emit: ClipEditorEmit) {
  const toast = useToast()
  const { overview, startTrim, startSplit, startCut, autoCrop, promote, remove } = useVideoEdits()

  const data = ref<EditOverview | null>(null)
  const error = ref('')

  // When a render with new audio finishes, say so and offer the next step right there.
  function announceNewAudioClips(before: VideoClip[] | undefined, after: VideoClip[]) {
    if (!before) return
    const known = new Set(before.map((c) => c.id))
    const fresh = after.find((c) => c.operation === 'AUDIO' && !known.has(c.id))
    if (!fresh) return
    toast.add({
      title: 'Your video with the new audio is ready',
      description: 'Preview it under Results, then replace the original or add it as a new video.',
      color: 'success',
      duration: 10000,
      actions: props.canWrite ? [{ label: 'Add as new video', onClick: () => openAsNew(fresh) }] : []
    })
  }
  // A finished result slides in with a brief glow, then settles.
  const freshClipIds = ref<number[]>([])
  let freshTimer: ReturnType<typeof setTimeout> | undefined
  function markFreshClips(before: VideoClip[] | undefined, after: VideoClip[]) {
    if (!before) return
    const known = new Set(before.map((c) => c.id))
    const fresh = after.filter((c) => !known.has(c.id)).map((c) => c.id)
    if (!fresh.length) return
    freshClipIds.value = fresh
    clearTimeout(freshTimer)
    freshTimer = setTimeout(() => (freshClipIds.value = []), 2000)
  }
  onBeforeUnmount(() => clearTimeout(freshTimer))
  async function load() {
    error.value = ''
    try {
      const before = data.value?.clips
      data.value = await overview(props.video.id)
      markFreshClips(before, data.value.clips)
      announceNewAudioClips(before, data.value.clips)
    } catch (err) {
      error.value = apiErrorMessage(err)
    }
  }

  // The Results card sits below a tall preview + controls grid — easy to miss
  // that anything happened after clicking "Start trim" etc, especially once
  // the layout stacks to a single column below the `xl` breakpoint.
  // Bound by `ref="resultsCard"` in a tab component (a template ref can't reach into a child).
  const resultsCard = shallowRef<{ $el: HTMLElement } | null>(null)
  function scrollToResults() {
    resultsCard.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  function onQueued() {
    load()
    scrollToResults()
  }

  const mode = ref<'trim' | 'split' | 'audio' | 'overlay' | 'join'>('trim')

  // Colours of the buttons in the Edit header: Recipes in amber (like the saved presets), Undo/Redo in blue while there is something to undo or redo.
  const HEADER_TONES = {
    recipes: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60',
    history: 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60'
  }

  // The keys that matter on the tab that is open.
  const TAB_KEYS: Partial<Record<typeof mode.value, string>> = {
    trim: 'I set start · O set end · ← → step a frame · Space play',
    split: 'S split here · [ ] previous / next segment · drag a cut on the strip',
    audio: 'Space play · ← → step a frame · Ctrl/⌘ Z undo',
    overlay: 'Arrow keys nudge the layer (Shift = further) · Delete removes it'
  }
  const tabKeysHint = computed(() => TAB_KEYS[mode.value] ?? '')

  const EDITOR_SHORTCUTS = [
    { keys: 'space', label: 'Play / pause' },
    { keys: 'K', label: 'Pause (and back to normal speed)' },
    { keys: '←', label: 'Previous frame' },
    { keys: '→', label: 'Next frame' },
    { keys: 'shift ←', label: 'Back 10 seconds' },
    { keys: 'shift →', label: 'Forward 10 seconds' },
    { keys: 'J', label: 'Slower; at normal speed, back 10 seconds' },
    { keys: 'L', label: 'Play; press again to play faster (up to 4×)' },
    { keys: 'F', label: 'Full screen' },
    { keys: 'I', label: 'Set the trim start to the playhead (Trim tab)' },
    { keys: 'O', label: 'Set the trim end to the playhead (Trim tab)' },
    { keys: 'S', label: 'Split at the playhead (Split tab)' },
    { keys: '[  ]', label: 'Previous / next segment (Split tab)' },
    { keys: 'ctrl/⌘ Z', label: 'Undo' },
    { keys: 'ctrl/⌘ shift Z', label: 'Redo' },
    { keys: 'space (drag)', label: 'Move around when zoomed in' },
    { keys: '←→↑↓', label: 'Nudge the selected layer (Text tab)' },
    { keys: 'shift ←→↑↓', label: 'Nudge further' },
    { keys: 'delete', label: 'Remove the selected layer (Text tab)' }
  ]

  // ── Preview player ───────────────────────────────────────────────────────────
  const preview = useTemplateRef<InstanceType<typeof VideoPlayer>>('preview')
  const currentMs = ref(0)
  const durationMs = ref((props.video.durationSeconds ?? 0) * 1000)
  const naturalWidth = ref(props.video.width ?? 0)
  const naturalHeight = ref(props.video.height ?? 0)
  function onTime(ms: number) {
    currentMs.value = ms
    // Playing through a cut-out range jumps over it, as the result will.
    if (mode.value === 'trim' && cuts.value.length) {
      const target = cutSkipTarget(cuts.value, ms)
      const el = preview.value?.videoEl
      if (target != null && el && !el.paused) el.currentTime = target / 1000
    }
  }
  function onDuration(seconds: number) {
    durationMs.value = seconds * 1000
    if (range.value[1] === 0) range.value = [0, durationMs.value]
    const el = preview.value?.videoEl
    if (el?.videoWidth) naturalWidth.value = el.videoWidth
    if (el?.videoHeight) naturalHeight.value = el.videoHeight
    settle()
  }

  // ── Zoom & pan the preview ───────────────────────────────────────────────────
  // A CSS transform on a wrapper (origin top-left): screen = pan + zoom × local.
  const zoomBox = useTemplateRef<HTMLDivElement>('zoomBox')
  const MAX_ZOOM = 6
  const zoom = ref(1)
  const pan = reactive({ x: 0, y: 0 })
  const hovering = ref(false)
  const spaceHeld = ref(false)
  const panning = ref(false)
  const cropActive = computed(() => mode.value === 'trim' && cropOn.value)

  // Safe-area guide: over the crop box when one is drawn, else over the whole picture.
  const showGuides = ref(false)
  const guideBox = computed(() => {
    if (!naturalWidth.value || !naturalHeight.value) return null
    const useCrop = cropOn.value && crop.w > 0 && crop.h > 0
    const box = useCrop ? crop : { x: 0, y: 0, w: naturalWidth.value, h: naturalHeight.value }
    const inset = safeInsets(box.w / box.h)
    const pct = (n: number) => `${n * 100}%`
    return {
      label: inset.bottom > 0.1 ? 'Shorts / Reels / TikTok safe area' : 'Safe area',
      style: {
        left: pct(box.x / naturalWidth.value),
        top: pct(box.y / naturalHeight.value),
        width: pct(box.w / naturalWidth.value),
        height: pct(box.h / naturalHeight.value)
      },
      safe: { left: pct(inset.left), top: pct(inset.top), right: pct(inset.right), bottom: pct(inset.bottom) }
    }
  })

  // Keeps the zoomed picture covering the frame — no panning off into empty space.
  function clampPan() {
    const el = zoomBox.value
    if (!el) return
    pan.x = Math.min(0, Math.max(el.clientWidth * (1 - zoom.value), pan.x))
    pan.y = Math.min(0, Math.max(el.clientHeight * (1 - zoom.value), pan.y))
  }
  // Zooms keeping the point (sx, sy) — in frame coordinates — where it is on screen.
  function zoomAt(factor: number, sx: number, sy: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, zoom.value * factor))
    if (next === zoom.value) return
    pan.x = sx - ((sx - pan.x) * next) / zoom.value
    pan.y = sy - ((sy - pan.y) * next) / zoom.value
    zoom.value = next
    clampPan()
  }
  function zoomBy(factor: number) {
    const el = zoomBox.value
    if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
  }
  function resetZoom() {
    zoom.value = 1
    pan.x = 0
    pan.y = 0
  }
  function onPreviewWheel(e: WheelEvent) {
    // At 100%, scrolling "out" is left to the modal, so the page still scrolls normally.
    if (zoom.value <= 1 && e.deltaY > 0) return
    e.preventDefault()
    const r = zoomBox.value!.getBoundingClientRect()
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
  }

  // A drag that moved shouldn't also count as a click (which would play/pause the video).
  function swallowNextClick() {
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
  }

  // Pans on Space+drag or middle-drag (plain drags are for cropping). Runs in
  // the capture phase so it wins over the crop layer and the player.
  function onPanStart(e: PointerEvent) {
    if (zoom.value <= 1) return
    if (e.button !== 1 && !(e.button === 0 && spaceHeld.value)) return
    e.preventDefault()
    e.stopPropagation()
    panning.value = true
    const start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    let moved = false
    const move = (ev: PointerEvent) => {
      moved ||= Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3
      pan.x = start.px + ev.clientX - start.x
      pan.y = start.py + ev.clientY - start.y
      clampPan()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener(
      'pointerup',
      () => {
        window.removeEventListener('pointermove', move)
        panning.value = false
        if (moved) swallowNextClick()
      },
      { once: true }
    )
  }

  // With crop off, dragging across the picture switches it on and draws the box
  // — no need to find the switch first. A plain click still plays/pauses, and
  // drags that start on the player's control bar are left to the player.
  const cropLayer = useTemplateRef<{ beginDraw: (from: { clientX: number; clientY: number }, to?: PointerEvent) => void }>('cropLayer')
  const CONTROL_BAR_PX = 56
  function onQuickCropStart(e: PointerEvent) {
    if (e.button !== 0 || spaceHeld.value || mode.value !== 'trim' || cropOn.value) return
    const r = zoomBox.value!.getBoundingClientRect()
    if (e.clientY >= r.top + pan.y + zoom.value * (r.height - CONTROL_BAR_PX)) return
    const from = { clientX: e.clientX, clientY: e.clientY }
    const move = async (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - from.clientX, ev.clientY - from.clientY) < 6) return
      cleanup()
      cropOn.value = true
      await nextTick()
      cropLayer.value?.beginDraw(from, ev)
      window.addEventListener('pointerup', swallowNextClick, { once: true })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cleanup)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', cleanup, { once: true })
  }

  // Only text entry keeps its Space. A focused button (e.g. the "Also crop"
  // switch just clicked) doesn't — Space must pan, not re-toggle it.
  function isTyping(target: EventTarget | null) {
    const el = target as HTMLElement | null
    return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
  }
  function onKeyDown(e: KeyboardEvent) {
    if (
      mode.value === 'trim' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !isTyping(e.target) &&
      !(e.target as HTMLElement | null)?.closest?.('[role="dialog"]')
    ) {
      if (e.key === 'i' || e.key === 'I' || e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        setEdge(e.key.toLowerCase() === 'i' ? 'start' : 'end', Math.round(currentMs.value))
        return
      }
    }
    if (
      mode.value === 'split' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !isTyping(e.target) &&
      !(e.target as HTMLElement | null)?.closest?.('[role="dialog"]')
    ) {
      if (e.key === 's' || e.key === 'S') {
        if (canSplitHere.value) {
          e.preventDefault()
          splitAtPlayhead()
        }
        return
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        const last = segments.value.length - 1
        const next = e.key === ']' ? Math.min(last, (selectedSegment.value ?? -1) + 1) : Math.max(0, (selectedSegment.value ?? 1) - 1)
        selectSegment(next)
        return
      }
    }
    // Only when zoomed: otherwise Space plays/pauses (EditorTransport).
    if (e.code !== 'Space' || !hovering.value || zoom.value <= 1 || isTyping(e.target)) return
    e.preventDefault()
    spaceHeld.value = true
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code !== 'Space' || !spaceHeld.value) return
    e.preventDefault()
    spaceHeld.value = false
  }
  // ── Full screen ──────────────────────────────────────────────────────────────
  // The player keeps its 16:9 box, so in full screen it's sized to fit the
  // height left over by the playback bar; the bar matches its width.
  const stage = useTemplateRef<HTMLDivElement>('stage')
  const stageFullscreen = ref(false)
  const fitStyle = computed(() => (stageFullscreen.value ? { width: 'min(100%, calc((100vh - 7.5rem) * 16 / 9))', marginInline: 'auto' } : undefined))
  function onFullscreenChange() {
    stageFullscreen.value = !!stage.value && document.fullscreenElement === stage.value
    nextTick(clampPan)
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  })

  // ── Trim & crop ────────────────────────────────────────────────────────────
  const range = ref<[number, number]>([0, durationMs.value])
  /** Let the trim's end run past the end of the video (the last frame is held, the sound is silent). */
  const extendOn = ref(false)
  const trimLimit = computed(() => trimLimitMs(durationMs.value, extendOn.value))
  const extension = computed(() => (extendOn.value ? extensionMs(range.value[1], durationMs.value) : 0))
  watch(extendOn, (on) => {
    if (!on && range.value[1] > durationMs.value) range.value = [Math.min(range.value[0], Math.max(0, durationMs.value - MIN_TRIM_MS)), durationMs.value]
  })
  // Starts with no selection: the first drag on the video draws it. (A
  // pre-made box covering most of the frame meant almost every press landed
  // inside it and moved it instead.)
  const cropOn = ref(false)
  const crop = reactive({ x: 0, y: 0, w: 0, h: 0 })
  function onCropToggle(on: boolean) {
    if (!on) {
      cropAspect.value = null
      Object.assign(crop, { x: 0, y: 0, w: 0, h: 0 })
    }
  }

  const ASPECTS: { label: string; value: number | null }[] = [
    { label: 'Free', value: null },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 }
  ]
  const cropAspect = ref<number | null>(null)
  /** Follow the action: the crop's shape, moved along with the motion by the server (auto-reframe), not the box drawn. */
  const followAction = ref(false)
  const reframing = computed(() => followAction.value && cropOn.value && !!cropAspect.value)
  // Picking a shape fits the largest box of that shape, centred on the current crop.
  function setAspect(aspect: number | null) {
    cropAspect.value = aspect
    if (!aspect || !naturalWidth.value || !naturalHeight.value) return
    const cx = crop.w ? crop.x + crop.w / 2 : naturalWidth.value / 2
    const cy = crop.h ? crop.y + crop.h / 2 : naturalHeight.value / 2
    Object.assign(crop, centeredCrop(aspect, naturalWidth.value, naturalHeight.value, cx, cy))
  }
  function cropFull() {
    cropAspect.value = null
    Object.assign(crop, { x: 0, y: 0, w: naturalWidth.value, h: naturalHeight.value })
  }

  // One-click sizing for common destinations: crop shape + output resolution together.
  interface ExportPreset {
    key: string
    label: string
    ratio: string
    aspect: number
    w: number
    h: number
    icon: string
    /** Set on presets saved in this browser — only those can be deleted. */
    customId?: string
  }
  const BUILTIN_PRESETS: ExportPreset[] = [
    { key: 'youtube', label: 'YouTube 1080p', ratio: '16:9', aspect: 16 / 9, w: 1920, h: 1080, icon: 'i-simple-icons-youtube' },
    { key: 'shorts', label: 'Shorts / Reels / TikTok', ratio: '9:16', aspect: 9 / 16, w: 1080, h: 1920, icon: 'i-lucide-smartphone' },
    { key: 'square', label: 'Square', ratio: '1:1', aspect: 1, w: 1080, h: 1080, icon: 'i-lucide-square' },
    { key: 'twitter', label: 'Twitter/X', ratio: '16:9', aspect: 16 / 9, w: 1280, h: 720, icon: 'i-lucide-message-square' }
  ]
  // Each destination gets its own accent so the buttons are easy to tell apart at a glance.
  const PRESET_TONES: Record<string, { icon: string; active: string }> = {
    youtube: {
      icon: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
      active: 'border-red-500 ring-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
    },
    shorts: {
      icon: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
      active: 'border-violet-500 ring-violet-500 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300'
    },
    square: {
      icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
      active: 'border-emerald-500 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
    },
    twitter: {
      icon: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
      active: 'border-sky-500 ring-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
    }
  }
  const CUSTOM_PRESET_TONE = {
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    active: 'border-amber-500 ring-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
  }
  function presetTone(p: ExportPreset) {
    return PRESET_TONES[p.key] ?? CUSTOM_PRESET_TONE
  }
  const exportPresets = useExportPresets()
  const EXPORT_PRESETS = computed<ExportPreset[]>(() => [
    ...BUILTIN_PRESETS,
    ...exportPresets.saved.value.map((e) => ({
      key: e.id,
      label: e.name,
      ratio: ratioLabel(e.data.aspect),
      ...e.data,
      icon: 'i-lucide-bookmark',
      customId: e.id
    }))
  ])
  function applyPreset(preset: ExportPreset) {
    cropOn.value = true
    setAspect(preset.aspect)
    scaleOn.value = true
    Object.assign(scale, { w: preset.w, h: preset.h })
    toast.add({ title: `Crop and resize set for ${preset.label}`, color: 'info' })
  }
  // A preset counts as chosen while its crop shape and output size are what is set,
  // so it un-highlights as soon as either is changed by hand.
  const activePreset = computed(() =>
    cropOn.value && scaleOn.value ? (EXPORT_PRESETS.value.find((p) => p.aspect === cropAspect.value && p.w === scale.w && p.h === scale.h) ?? null) : null
  )
  // "Several formats at once": presets are ticked instead of applied, then one trim
  // per tick is queued — same range, each with its own centred crop and size.
  const multiExport = ref(false)
  const multiKeys = ref<string[]>([])
  const startingMulti = ref(false)
  const multiPresets = computed(() => EXPORT_PRESETS.value.filter((p) => multiKeys.value.includes(p.key)))
  function isPresetOn(p: ExportPreset) {
    return multiExport.value ? multiKeys.value.includes(p.key) : activePreset.value?.key === p.key
  }
  function onPresetClick(p: ExportPreset) {
    if (!multiExport.value) return togglePreset(p)
    multiKeys.value = multiKeys.value.includes(p.key) ? multiKeys.value.filter((k) => k !== p.key) : [...multiKeys.value, p.key]
  }
  // The server queues at most MAX_QUEUED_EDITS edits per video, so only that many formats fit (fewer while others are waiting).
  const queueSlots = computed(() => Math.max(0, MAX_QUEUED_EDITS - runningCount.value))
  const multiError = computed(() => {
    if (!multiKeys.value.length) return 'Tick the formats you want.'
    if (multiKeys.value.length > queueSlots.value) {
      return queueSlots.value
        ? `Only ${queueSlots.value} more ${queueSlots.value === 1 ? 'edit fits' : 'edits fit'} in the queue — untick ${multiKeys.value.length - queueSlots.value}.`
        : 'The queue is full — wait for an edit to finish.'
    }
    if (!naturalWidth.value || !naturalHeight.value) return 'Waiting for the video to load.'
    return (
      validateLook(look.value) ??
      validateTrimAudio(trimAudio.value, Math.round(range.value[1] - range.value[0])) ??
      validateTrim(Math.round(range.value[0]), Math.round(range.value[1]), Math.round(durationMs.value) || null, extendOn.value)
    )
  })
  const multiSummary = computed(() =>
    multiKeys.value.length
      ? `${multiKeys.value.length} new video${multiKeys.value.length === 1 ? '' : 's'}, each ${formatMsShort(range.value[1] - range.value[0])} long, cropped from the centre: ${multiPresets.value.map((p) => p.label).join(', ')}.`
      : 'Tick two or more formats above — each becomes its own result, cropped from the centre of the picture.'
  )
  async function onStartMulti() {
    if (multiError.value || startingMulti.value) return
    startingMulti.value = true
    let queued = 0
    try {
      for (const p of multiPresets.value) {
        await startTrim(props.video.id, {
          startMs: Math.round(range.value[0]),
          endMs: Math.round(range.value[1]),
          crop: centeredCrop(p.aspect, naturalWidth.value, naturalHeight.value),
          scale: { w: p.w, h: p.h },
          audio: trimAudioRequest(trimAudio.value),
          extend: extension.value > 0 || undefined,
          look: lookRequest(look.value)
        })
        queued++
      }
      toast.add({ title: `${queued} export${queued === 1 ? '' : 's'} queued`, color: 'success' })
      multiKeys.value = []
      scrollToResults()
    } catch (err) {
      const left = multiPresets.value
        .slice(queued)
        .map((p) => p.label)
        .join(', ')
      toast.add({
        title: queued ? `${queued} queued, then it stopped` : 'Could not queue the exports',
        description: `${apiErrorMessage(err)}${queued ? ` Not queued: ${left}.` : ''}`,
        color: 'error'
      })
    } finally {
      startingMulti.value = false
      await load()
    }
  }

  function togglePreset(preset: ExportPreset) {
    if (activePreset.value?.key !== preset.key) return applyPreset(preset)
    // Choosing the active preset again clears what it set.
    cropOn.value = false
    onCropToggle(false)
    scaleOn.value = false
  }

  // Saving the current crop shape + output size as a preset of your own.
  const savingPreset = ref(false)
  const presetName = ref('')
  const MAX_PRESET_NAME = 40
  // Bound by `ref="presetNameInput"` in a tab component (a template ref can't reach into a child).
  const presetNameInput = shallowRef<{ inputRef?: HTMLInputElement } | null>(null)
  const presetToSave = computed(() => (activePreset.value ? null : presetFromSettings(cropOn.value, cropAspect.value, scaleOn.value, scale)))
  const takenPresetNames = computed(() => [...BUILTIN_PRESETS.map((b) => b.label), ...exportPresets.saved.value.map((e) => e.name)])
  // If the name is taken, the list adds "(2)" — say so before it happens.
  const presetRenamedTo = computed(() => {
    const wanted = presetName.value.trim()
    if (!wanted) return ''
    const unique = uniqueName(wanted, takenPresetNames.value)
    return unique === wanted ? '' : unique
  })
  const presetsFull = computed(() => exportPresets.saved.value.length >= MAX_NAMED_ENTRIES)
  function openSavePreset() {
    const data = presetToSave.value
    // A starting name that describes the shape, ready to be typed over.
    if (data && !presetName.value.trim()) presetName.value = `${ratioLabel(data.aspect)} ${data.w}×${data.h}`
    nextTick(() => {
      const el = presetNameInput.value?.inputRef
      el?.focus()
      el?.select()
    })
  }
  function onSavePreset() {
    const data = presetToSave.value
    const name = presetName.value.trim()
    if (!data || !name) return
    const finalName = uniqueName(name, takenPresetNames.value)
    exportPresets.save(finalName, data)
    toast.add({ title: `Saved preset “${finalName}”`, description: 'It is under Export for, ready to pick on any video.', color: 'success' })
    presetName.value = ''
    savingPreset.value = false
  }
  // Share saved presets as a small JSON file.
  // Bound by `ref="presetFileInput"` in a tab component (a template ref can't reach into a child).
  const presetFileInput = shallowRef<HTMLInputElement | null>(null)
  function onExportPresets() {
    const url = URL.createObjectURL(new Blob([exportPresets.exportJson()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'export-presets.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  async function onImportPresets(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const added = exportPresets.importJson(await file.text())
      toast.add(
        added
          ? { title: `Added ${added} preset${added === 1 ? '' : 's'}`, color: 'success' }
          : { title: 'Nothing new to add', description: 'You already have every preset in that file.', color: 'info' }
      )
    } catch (err) {
      toast.add({ title: 'Could not import presets', description: err instanceof Error ? err.message : undefined, color: 'error' })
    }
  }

  // Rename a saved preset in place.
  const renamingId = ref<string | null>(null)
  const renameText = ref('')
  // Bound by `ref="renameInput"` in a tab component (a template ref can't reach into a child).
  const renameInput = shallowRef<{ inputRef?: HTMLInputElement } | null>(null)
  function startRename(preset: ExportPreset) {
    renamingId.value = preset.customId ?? null
    renameText.value = preset.label
    nextTick(() => {
      const el = Array.isArray(renameInput.value) ? renameInput.value[0]?.inputRef : renameInput.value?.inputRef
      el?.focus()
      el?.select()
    })
  }
  function otherPresetNames(preset: ExportPreset) {
    return [...BUILTIN_PRESETS.map((b) => b.label), ...exportPresets.saved.value.filter((e) => e.id !== preset.customId).map((e) => e.name)]
  }
  // If the new name is taken by another preset, "(2)" is added — say so first.
  function renameClash(preset: ExportPreset) {
    const wanted = renameText.value.trim()
    if (!wanted) return ''
    const unique = uniqueName(wanted, otherPresetNames(preset))
    return unique === wanted ? '' : unique
  }
  function onRenamePreset(preset: ExportPreset) {
    const name = renameText.value.trim()
    if (!preset.customId || !name) return
    const finalName = uniqueName(name, otherPresetNames(preset))
    if (finalName !== preset.label) exportPresets.rename(preset.customId, finalName)
    toast.add({ title: `Renamed to “${finalName}”`, color: 'success' })
    renamingId.value = null
  }
  function removePreset(preset: ExportPreset) {
    if (!preset.customId) return
    exportPresets.remove(preset.customId)
    const { label, aspect, w, h } = preset
    toast.add({
      title: `Deleted preset “${label}”`,
      color: 'info',
      actions: [{ label: 'Undo', onClick: () => exportPresets.save(label, { aspect, w, h }) }]
    })
  }

  // The crop is normally drawn on the video; the four numbers are for exact values.
  const cropFieldsOpen = ref(false)

  // Turn and flip (applied after the crop, before the resize).
  const orient = ref<Orientation>({ ...NO_ORIENTATION })
  const orientActive = computed(() => hasOrientation(orient.value))
  // The sample "F" shows the result: turn clockwise, then flip (CSS lists the last step first).
  // The preview does the same to the whole player; after a quarter turn it is shrunk to stay inside the 16:9 box.
  const previewOriented = computed(() => orientActive.value && !cropActive.value)
  const previewOrientStyle = computed(() => {
    if (!previewOriented.value) return undefined
    const o = orient.value
    const fit = swapsSides(o) ? 9 / 16 : 1
    return { transform: `scale(${fit}) scaleX(${o.flipH ? -1 : 1}) scaleY(${o.flipV ? -1 : 1}) rotate(${o.rotate}deg)`, transformOrigin: 'center' }
  })
  const orientSampleTransform = computed(
    () => `scaleX(${orient.value.flipH ? -1 : 1}) scaleY(${orient.value.flipV ? -1 : 1}) rotate(${orient.value.rotate}deg)`
  )

  function resetTrim() {
    orient.value = { ...NO_ORIENTATION }
    extendOn.value = false
    look.value = { ...PLAIN_LOOK }
    range.value = [0, durationMs.value]
    cropOn.value = false
    onCropToggle(false)
    scaleOn.value = false
  }

  // ── Trim range: typed times and nudges ───────────────────────────────────────
  const TRIM_EDGES = [
    { key: 'start' as const, label: 'Start' },
    { key: 'end' as const, label: 'End' }
  ]
  function setEdge(edge: 'start' | 'end', ms: number) {
    range.value = withTrimEdge(range.value, edge, ms, edge === 'end' ? trimLimit.value : durationMs.value)
  }
  function nudgeEdge(edge: 'start' | 'end', deltaMs: number) {
    setEdge(edge, range.value[edge === 'start' ? 0 : 1] + deltaMs)
  }
  function typeEdge(edge: 'start' | 'end', event: Event) {
    const input = event.target as HTMLInputElement
    const ms = parseTimecode(input.value)
    if (ms === null) {
      toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
    } else {
      setEdge(edge, ms)
    }
    // Show the accepted (clamped) value, or put the old one back.
    input.value = formatTimecode(range.value[edge === 'start' ? 0 : 1])
  }

  // "Auto-center": a crop box centred on wherever the video moves the most,
  // instead of eyeballing it — a scoped stand-in for continuous face/subject
  // tracking, which this server's ffmpeg build can't do reliably.
  const autoCentering = ref(false)
  async function onAutoCenter() {
    if (!cropAspect.value) return
    autoCentering.value = true
    try {
      const r = await autoCrop(props.video.id, cropAspect.value)
      Object.assign(crop, r)
    } catch (err) {
      toast.add({ title: 'Could not suggest a crop', description: apiErrorMessage(err), color: 'error' })
    } finally {
      autoCentering.value = false
    }
  }

  // While cropping, the crop layer covers the player's own controls — moving a
  // trim handle shows that frame instead, so the crop can be checked anywhere.
  watch(
    () => range.value[0],
    (ms) => cropOn.value && preview.value?.seek(ms, false)
  )
  watch(
    () => range.value[1],
    (ms) => cropOn.value && preview.value?.seek(ms, false)
  )
  const scaleOn = ref(false)
  const scale = reactive({ w: 0, h: 0 })
  /** The picture the resize starts from (after the crop and the turn). */
  const resizeFrom = computed(() => pictureBeforeResize(naturalWidth.value, naturalHeight.value, cropOn.value ? crop : null, orient.value))
  const resizeOptions = computed(() => (resizeFrom.value ? resizeChoices(resizeFrom.value) : []))
  const scaleNotes = computed(() => (resizeFrom.value ? resizeNotes(scale, resizeFrom.value) : { larger: false, stretched: false }))
  /** "Keep shape": typing one side works out the other. Not part of the edit, so not in undo or drafts. */
  const scaleLock = ref(true)
  function onScaleToggle(on: boolean) {
    if (on && !scale.w) Object.assign(scale, resizeFrom.value ?? { w: 1280, h: 720 })
  }
  function setScaleSide(side: 'w' | 'h', value: number) {
    if (scaleLock.value && resizeFrom.value) Object.assign(scale, keepShapeSize(side, value, resizeFrom.value))
    else scale[side] = value
  }
  function pickScale(size: { w: number; h: number }) {
    Object.assign(scale, { w: size.w, h: size.h })
  }
  /** Puts the shape back to the picture's, keeping the width. */
  function matchScaleShape() {
    if (resizeFrom.value) Object.assign(scale, keepShapeSize('w', scale.w, resizeFrom.value))
  }

  const trimError = computed(() => {
    const err = validateTrim(Math.round(range.value[0]), Math.round(range.value[1]), Math.round(durationMs.value) || null, extendOn.value)
    if (err) return err
    if (reframing.value && orientActive.value) return "Follow the action can't be used with a turn"
    if (cropOn.value && !reframing.value) {
      if (!crop.w || !crop.h) return 'Drag on the video to choose the area to keep'
      const e = validateCrop(crop.x, crop.y, crop.w, crop.h, naturalWidth.value || null, naturalHeight.value || null)
      if (e) return e
    }
    if (scaleOn.value) {
      const e = validateScale(scale.w, scale.h)
      if (e) return e
    }
    return (
      validateLook(look.value) ??
      motionProblem(motion.value, Math.round(range.value[1] - range.value[0]) || null) ??
      extrasProblem(extras.value, naturalWidth.value, naturalHeight.value) ??
      validateTrimAudio(trimAudio.value, Math.round(range.value[1] - range.value[0]))
    )
  })

  const starting = ref(false)
  async function onStartTrim() {
    if (trimError.value) return
    starting.value = true
    try {
      const job = await startTrim(props.video.id, {
        startMs: Math.round(range.value[0]),
        endMs: Math.round(range.value[1]),
        crop: cropOn.value && !reframing.value ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h } : null,
        scale: scaleOn.value ? { w: scale.w, h: scale.h } : null,
        ...orientationRequest(orient.value),
        ...(reframing.value ? { reframe: { aspect: cropAspect.value! } } : {}),
        audio: trimAudioRequest(trimAudio.value),
        extend: extension.value > 0 || undefined,
        look: lookRequest(look.value),
        ...motionRequest(motion.value),
        ...extrasRequest(extras.value)
      })
      toast.add({ title: `Trim queued — job #${job.id}`, color: 'success' })
      await load()
      scrollToResults()
    } catch (err) {
      toast.add({ title: 'Could not start the trim', description: apiErrorMessage(err), color: 'error' })
    } finally {
      starting.value = false
    }
  }

  // ── Cut out ranges ───────────────────────────────────────────────────────────
  const cuts = ref<CutRange[]>([])
  const trimAudio = ref<TrimAudioSettings | null>(null)
  const look = ref<VideoLook>({ ...PLAIN_LOOK })
  /** The before/after divider on the preview, while a look is set (a way of looking, not part of the edit). */
  const lookCompare = ref(false)
  const lookCompareShown = computed(() => mode.value === 'trim' && lookCompare.value && !isPlainLook(look.value))
  /** Motion & effects on the trim (videoMotion.ts); times on the trimmed clip. */
  const motion = ref<VideoMotion>({ ...PLAIN_MOTION })
  /** Blur areas, picture in picture and title cards on the trim (trimExtras.ts). */
  const extras = ref<TrimExtras>(sanitizeExtras(null))
  /** The blur boxes show (and can be dragged) on the preview while their section is open. */
  const blurEditing = ref(false)
  const blursShown = computed(() => mode.value === 'trim' && blurEditing.value && extras.value.blurs.length > 0)
  const cutStarting = ref(false)
  async function onStartCut() {
    if (validateCutOut(cuts.value, Math.round(durationMs.value) || null)) return
    cutStarting.value = true
    try {
      const job = await startCut(
        props.video.id,
        mergeCutRanges(cuts.value).map((c) => ({ startMs: Math.round(c.startMs), endMs: Math.round(c.endMs) }))
      )
      toast.add({ title: `Cut queued — job #${job.id}`, color: 'success' })
      await load()
      scrollToResults()
    } catch (err) {
      toast.add({ title: 'Could not start the cut', description: apiErrorMessage(err), color: 'error' })
    } finally {
      cutStarting.value = false
    }
  }

  // ── Split into segments ──────────────────────────────────────────────────────
  interface SegmentInput {
    startMsSeconds: number
    endMsSeconds: number | null
  }
  const segments = ref<SegmentInput[]>([{ startMsSeconds: 0, endMsSeconds: null }])

  // A quick-glance strip above the raw-seconds inputs — numbers alone make it
  // easy to miss a gap or an overlap between segments.
  const SEGMENT_COLORS = ['bg-primary-500', 'bg-info-500', 'bg-success-500', 'bg-warning-500', 'bg-violet-500', 'bg-rose-500']
  const segmentBars = computed(() => {
    if (!durationMs.value) return []
    return segments.value.map((s, i) => {
      const startMs = Math.max(0, s.startMsSeconds * 1000)
      const endMs = s.endMsSeconds != null ? s.endMsSeconds * 1000 : durationMs.value
      const leftPct = Math.min(100, (startMs / durationMs.value) * 100)
      const widthPct = Math.max(0, Math.min(100 - leftPct, ((endMs - startMs) / durationMs.value) * 100))
      return { leftPct, widthPct, valid: endMs > startMs, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }
    })
  })

  function resetSplit() {
    segments.value = [{ startMsSeconds: 0, endMsSeconds: null }]
    selectedSegment.value = null
  }

  const selectedSegment = ref<number | null>(null)
  function selectSegment(i: number) {
    selectedSegment.value = i
    const seg = segments.value[i]
    if (seg) preview.value?.seek(seg.startMsSeconds * 1000, false)
  }
  function removeSegment(i: number) {
    segments.value.splice(i, 1)
    selectedSegment.value = null
  }

  // What is wrong with one row, shown under it as it is typed (the bottom message names the first problem only).
  function rowProblem(seg: SegmentInput): string | null {
    return validateTrim(
      Math.round(seg.startMsSeconds * 1000),
      seg.endMsSeconds == null ? null : Math.round(seg.endMsSeconds * 1000),
      Math.round(durationMs.value) || null
    )
  }
  function segmentEndSeconds(seg: SegmentInput) {
    return seg.endMsSeconds ?? durationMs.value / 1000
  }
  function segmentLength(seg: SegmentInput) {
    return formatMsShort(Math.max(0, (segmentEndSeconds(seg) - seg.startMsSeconds) * 1000))
  }

  // Typed times ("1:23", "1:23.5"); an empty end means "to the end of the video".
  function typeSegment(i: number, edge: 'start' | 'end', event: Event) {
    const seg = segments.value[i]
    const input = event.target as HTMLInputElement
    if (!seg) return
    if (edge === 'end' && input.value.trim() === '') {
      seg.endMsSeconds = null
    } else {
      const ms = parseTimecode(input.value)
      if (ms === null) toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
      else if (edge === 'start') seg.startMsSeconds = ms / 1000
      else seg.endMsSeconds = ms / 1000
    }
    // Show what was accepted, or put the old value back.
    input.value = edge === 'start' ? formatTimecode(seg.startMsSeconds * 1000) : seg.endMsSeconds == null ? '' : formatTimecode(seg.endMsSeconds * 1000)
  }

  // The segment the playhead is inside, if it can be cut in two there.
  const splitTarget = computed(() => findSplitTarget(segments.value, currentMs.value / 1000, durationMs.value / 1000))
  const canSplitHere = computed(() => !!durationMs.value && splitTarget.value !== null)
  function splitAtPlayhead() {
    const i = splitTarget.value
    if (i === null) return
    segments.value = splitRowAt(segments.value, i, currentMs.value / 1000)
    selectedSegment.value = i + 1
  }

  // Video not covered by any segment (gaps between them, or before the first).
  const uncoveredMs = computed(() => uncoveredTime(segments.value, durationMs.value))
  const splitSummary = computed(() => {
    const n = segments.value.length
    return `${n} segment${n === 1 ? '' : 's'} → ${n} new video${n === 1 ? '' : 's'}${uncoveredMs.value > 0 && !splitError.value ? ` · ${formatMsShort(uncoveredMs.value)} left out` : ''}`
  })

  // Bound by `ref="segmentStrip"` in a tab component (a template ref can't reach into a child).
  const segmentStrip = shallowRef<HTMLDivElement | null>(null)
  function dragBoundary(i: number, e: PointerEvent) {
    const strip = segmentStrip.value
    if (!strip || !durationMs.value) return
    const rect = strip.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const seconds = (((ev.clientX - rect.left) / rect.width) * durationMs.value) / 1000
      segments.value = moveBoundary(segments.value, i, seconds, durationMs.value)
    }
    const done = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done, { once: true })
    move(e)
  }
  function nudgeBoundary(i: number, dir: 1 | -1, big: boolean) {
    const at = boundaryAfter(segments.value, i)
    if (at !== null) segments.value = moveBoundary(segments.value, i, at + dir * (big ? 1 : 0.1), durationMs.value)
  }

  // "Every N seconds"
  const everySeconds = ref<number | null>(null)
  const everyRows = computed(() => (everySeconds.value ? splitEveryRows(durationMs.value, everySeconds.value) : []))
  function splitEvery() {
    if (everyRows.value.length) segments.value = everyRows.value
  }

  // What the even-split buttons would make, e.g. "4 parts × 2:30".
  const evenPreview = computed(() => {
    const n = customPartsValid.value ? customParts.value : null
    return n && durationMs.value ? `${n} parts × about ${formatMsShort(durationMs.value / n)} each` : ''
  })
  // A rough size per new video: the file's size in proportion to the segment's length.
  const splitSizeHint = computed(() => {
    const size = props.video.fileSize
    if (!size || !durationMs.value || segments.value.length < 2 || splitError.value) return ''
    const biggest = Math.max(...segments.value.map((s) => (segmentEndSeconds(s) - s.startMsSeconds) * 1000))
    return `About ${formatFileSize(size * (biggest / durationMs.value))} for the largest new video (estimate)`
  })

  const customParts = ref<number | null>(null)
  const evenPartsMax = computed(() => maxEvenParts(durationMs.value))
  const tooManyPartsHint = computed(() => `At most ${evenPartsMax.value} parts for this video (each at least ${MIN_TRIM_MS / 1000}s, up to ${MAX_SEGMENTS})`)
  const customPartsValid = computed(() => Number.isInteger(customParts.value) && customParts.value! >= 2 && customParts.value! <= evenPartsMax.value)
  function splitEvenly(n: number | null) {
    const rows = n ? splitEvenlyRows(durationMs.value, n) : []
    if (rows.length) segments.value = rows
  }
  const splitError = computed(() =>
    validateSegments(
      segments.value.map((s) => ({ startMs: Math.round(s.startMsSeconds * 1000), endMs: s.endMsSeconds == null ? null : Math.round(s.endMsSeconds * 1000) })),
      Math.round(durationMs.value) || null
    )
  )
  async function onStartSplit() {
    if (splitError.value) return
    starting.value = true
    try {
      const job = await startSplit(
        props.video.id,
        segments.value.map((s) => ({ startMs: Math.round(s.startMsSeconds * 1000), endMs: s.endMsSeconds == null ? null : Math.round(s.endMsSeconds * 1000) }))
      )
      toast.add({ title: `Split queued — job #${job.id}`, color: 'success' })
      await load()
      scrollToResults()
    } catch (err) {
      toast.add({ title: 'Could not start the split', description: apiErrorMessage(err), color: 'error' })
    } finally {
      starting.value = false
    }
  }

  // ── Jobs (poll while any are active) ─────────────────────────────────────────
  const visibleJobs = computed<ProcessingJob[]>(() => {
    const jobs = data.value?.jobs ?? []
    const active = jobs.filter((j) => isActiveJobStatus(j.status))
    const latest = jobs[0]
    return latest && latest.status === 'FAILED' ? [...active, latest] : active
  })
  // Stopping a running edit needs the jobs module's APPROVE permission (see useProcessingJobs).
  const { can } = useAuth()
  const jobsApi = useProcessingJobs()
  const canCancel = computed(() => can('processing-jobs', 'APPROVE'))
  const canRetry = computed(() => can('processing-jobs', 'WRITE'))
  const retryingId = ref<number | null>(null)
  async function onRetryJob(job: ProcessingJob) {
    retryingId.value = job.id
    try {
      await jobsApi.retry(job.id)
      toast.add({ title: `${jobLabel(job).replace(/ failed$/, '')} queued again`, color: 'success' })
      await load()
    } catch (err) {
      toast.add({ title: 'Could not retry the job', description: apiErrorMessage(err), color: 'error' })
    } finally {
      retryingId.value = null
    }
  }
  const cancellingId = ref<number | null>(null)
  async function onCancelJob(job: ProcessingJob) {
    cancellingId.value = job.id
    try {
      await jobsApi.cancel(job.id)
      toast.add({ title: `${jobLabel(job)} cancelled`, color: 'info' })
      await load()
    } catch (err) {
      toast.add({ title: 'Could not cancel the job', description: apiErrorMessage(err), color: 'error' })
    } finally {
      cancellingId.value = null
    }
  }
  const busy = computed(() => visibleJobs.value.some((j) => isActiveJobStatus(j.status)))
  const JOB_LABELS: Record<string, string> = {
    TRIM: 'Trim',
    CUT: 'Cut out',
    SPLIT: 'Split',
    AUDIO: 'Video with new audio',
    EXTRACT: 'Audio extract',
    OVERLAY: 'Text & overlay',
    AUDIO_TO_VIDEO: 'Audio to video'
  }
  function jobLabel(job: ProcessingJob) {
    let operation = 'Edit'
    try {
      operation = JOB_LABELS[JSON.parse(job.parameters ?? '{}').operation] ?? 'Edit'
    } catch {
      // Default label above.
    }
    if (job.status === 'FAILED') return `${operation} failed`
    return job.status === 'QUEUED' ? `${operation} — waiting` : `${operation} in progress`
  }

  let pollTimer: ReturnType<typeof setInterval> | undefined
  watch(busy, (isBusy) => {
    clearInterval(pollTimer)
    if (isBusy) pollTimer = setInterval(load, 3000)
  })
  onBeforeUnmount(() => clearInterval(pollTimer))

  // Fresh state on load, and again whenever the video's file changes
  // (e.g. after "Replace original") — the old ranges/crop don't apply to it.
  function reset() {
    mode.value = 'trim'
    cropOn.value = false
    resetZoom()
    cropAspect.value = null
    Object.assign(crop, { x: 0, y: 0, w: 0, h: 0 })
    scaleOn.value = false
    segments.value = [{ startMsSeconds: 0, endMsSeconds: null }]
    durationMs.value = (props.video.durationSeconds ?? 0) * 1000
    naturalWidth.value = props.video.width ?? 0
    naturalHeight.value = props.video.height ?? 0
    range.value = [0, durationMs.value]
    audioEdit.reset()
    overlayEdit.reset()
    draftOffered = false
    settle()
    load()
  }
  onMounted(reset)
  watch(() => props.video.videoUrl, reset)

  // The last tab used on this video comes back next time (a convenience only).
  const tabKey = () => `videolingo:editor-tab:${props.video.id}`
  const MODES = ['trim', 'split', 'audio', 'overlay', 'join']
  onMounted(() => {
    try {
      const saved = localStorage.getItem(tabKey())
      if (saved && MODES.includes(saved)) mode.value = saved as typeof mode.value
    } catch {
      // Storage can be blocked; starting on Trim is fine.
    }
  })
  watch(mode, (m) => {
    try {
      localStorage.setItem(tabKey(), m)
    } catch {
      // See above.
    }
  })

  // The look shows on the preview while on the Trim tab (a close match to the render; dark corners aren't shown).
  watchEffect(() => {
    const el = preview.value?.videoEl
    if (el) el.style.filter = mode.value === 'trim' ? cssFilter(look.value) : ''
  })

  // ── Audio ────────────────────────────────────────────────────────────────────
  const audioEdit = useAudioEdit(durationMs)

  // While on the Audio tab the preview plays the level, the muted ranges and the
  // fades (the rest needs rendering). The <video> can't go above 100%.
  watchEffect(() => {
    const el = preview.value?.videoEl
    if (!el) return
    if (mode.value !== 'audio') {
      el.volume = 1
      el.muted = false
      return
    }
    setPreviewGain(el, currentMs.value)
  })
  function setPreviewGain(el: HTMLVideoElement, ms: number) {
    const gain = previewGainAt(audioEdit.state, durationMs.value, ms)
    el.volume = gain
    el.muted = gain === 0
  }
  // The time above comes ~4× a second, which makes a fade step; with fades set, follow the video every frame.
  let fadeFrame = 0
  function followFades() {
    const el = preview.value?.videoEl
    fadeFrame = requestAnimationFrame(followFades)
    if (el && !el.paused) setPreviewGain(el, el.currentTime * 1000)
  }
  watch(
    () => mode.value === 'audio' && (audioEdit.state.fadeInMs > 0 || audioEdit.state.fadeOutMs > 0),
    (on) => {
      cancelAnimationFrame(fadeFrame)
      fadeFrame = on ? requestAnimationFrame(followFades) : 0
    },
    { immediate: true }
  )
  onBeforeUnmount(() => cancelAnimationFrame(fadeFrame))

  // The background music, played beside the preview on the Audio tab when its file was added in this visit
  // (at its volume up to 100 %, from its start, looping; the ducking is heard only in the result).
  const musicPreviewUrl = computed(() => {
    const m = audioEdit.state.music
    return mode.value === 'audio' && m ? (audioEdit.localUrls.get(m.key) ?? null) : null
  })
  let musicEl: HTMLAudioElement | null = null
  let musicFrame = 0
  function stopMusic() {
    cancelAnimationFrame(musicFrame)
    musicFrame = 0
    musicEl?.pause()
  }
  function followMusic() {
    musicFrame = requestAnimationFrame(followMusic)
    const el = preview.value?.videoEl
    const m = audioEdit.state.music
    if (!el || !m || !musicEl) return
    const at = musicPositionAt(m, el.currentTime * 1000)
    musicEl.volume = Math.min(1, m.volume)
    musicEl.playbackRate = el.playbackRate
    if (el.paused || at === null) {
      if (!musicEl.paused) musicEl.pause()
      return
    }
    // Catch up after a seek, a loop round or drift.
    if (Math.abs(musicEl.currentTime * 1000 - at) > 250) musicEl.currentTime = at / 1000
    if (musicEl.paused) musicEl.play().catch(() => {})
  }
  watch(
    musicPreviewUrl,
    (url) => {
      stopMusic()
      if (!url) return
      if (!musicEl) musicEl = new Audio()
      if (musicEl.src !== url) musicEl.src = url
      musicEl.loop = false
      musicFrame = requestAnimationFrame(followMusic)
    },
    { immediate: true }
  )
  onBeforeUnmount(() => {
    stopMusic()
    musicEl = null
  })

  // ── Undo / redo, and the draft kept in this browser ─────────────────────────
  // Everything the tabs edit (not which tab or item is selected). audioEdit
  // must exist before this: useEditorHistory reads the current state right
  // away to seed history, and takeState() below touches audioEdit.state.
  const overlayEdit = useOverlayEdit(durationMs)
  const joinEdit = useJoinEdit(() => props.video)
  watch(() => props.video.id, joinEdit.reset)
  watch(() => [props.video.title, props.video.durationSeconds, props.video.videoUrl], joinEdit.refreshOwn)

  // A dot on a tab means it has pending settings — easy to miss otherwise,
  // since switching tabs doesn't reset or hide what's already set there.
  const trimDirty = computed(
    () =>
      !isPlainLook(look.value) ||
      !isPlainMotion(motion.value) ||
      !isPlainExtras(extras.value) ||
      !!trimAudio.value ||
      cropOn.value ||
      scaleOn.value ||
      orientActive.value ||
      range.value[0] !== 0 ||
      range.value[1] !== durationMs.value
  )
  const splitDirty = computed(() => segments.value.length > 1 || segments.value[0]?.startMsSeconds !== 0 || segments.value[0]?.endMsSeconds != null)
  const DIRTY_BADGE = { color: 'warning' as const, size: 'xs' as const }

  // A rough file size for the result: the original's, in proportion to the part kept (and the resize, if any).
  // The server re-encodes, so the real size can differ — it is only a guide.
  const trimSizeHint = computed(() => {
    const size = props.video.fileSize
    if (!size || !durationMs.value) return ''
    const kept = Math.max(0, range.value[1] - range.value[0]) / durationMs.value
    const pixels =
      scaleOn.value && scale.w && scale.h && naturalWidth.value && naturalHeight.value ? (scale.w * scale.h) / (naturalWidth.value * naturalHeight.value) : 1
    const area =
      cropOn.value && crop.w && crop.h && naturalWidth.value && naturalHeight.value && !scaleOn.value
        ? (crop.w * crop.h) / (naturalWidth.value * naturalHeight.value)
        : 1
    return `About ${formatFileSize(size * kept * pixels * area)} (estimate)`
  })

  // What "Start trim" will make, in one line.
  const trimSummary = computed(() => {
    const parts = [`Trim ${formatMsShort(range.value[0])}–${formatMsShort(range.value[1])} (${formatMsShort(range.value[1] - range.value[0])})`]
    if (activePreset.value) parts.push(activePreset.value.label)
    else {
      if (cropOn.value && crop.w && crop.h && !reframing.value) parts.push(`crop ${crop.w}×${crop.h}`)
      if (scaleOn.value && scale.w && scale.h) parts.push(`resize ${scale.w}×${scale.h}`)
    }
    if (reframing.value) parts.push('crop follows the action')
    if (orientActive.value) parts.push(describeOrientation(orient.value))
    if (extension.value) parts.push(`${formatMsShort(extension.value)} past the end (last frame held)`)
    const lookLine = describeVideoLook(look.value)
    if (lookLine) parts.push(lookLine)
    const motionLine = describeMotion(motion.value)
    if (motionLine) parts.push(motionLine)
    const extrasLine = describeExtras(extras.value)
    if (extrasLine) parts.push(extrasLine)
    const audioLine = describeTrimAudio(trimAudio.value)
    if (audioLine) parts.push(audioLine)
    return parts.join(' · ')
  })
  // Each tab has its own colour: the selected tab is a filled pill in it with white text and icon (the 700
  // shade keeps white above 4.5:1), so it's clear which tool is open. The others stay plain.
  const TAB_TONES: Record<typeof mode.value, { indicator: string; ui: { trigger: string; leadingIcon: string; label: string } }> = {
    trim: {
      indicator: 'bg-sky-700 shadow-sm',
      ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white', label: '' }
    },
    split: {
      indicator: 'bg-violet-700 shadow-sm',
      ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white', label: '' }
    },
    audio: {
      indicator: 'bg-emerald-700 shadow-sm',
      ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white', label: '' }
    },
    overlay: {
      indicator: 'bg-rose-700 shadow-sm',
      ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white', label: '' }
    },
    join: {
      indicator: 'bg-orange-700 shadow-sm',
      ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white', label: '' }
    }
  }
  // A tab whose edit is being made shows its progress on the tab, so it can be left
  // and checked on from anywhere (the Results card below has the detail).
  const JOB_TAB: Record<string, typeof mode.value> = { TRIM: 'trim', CUT: 'trim', SPLIT: 'split', AUDIO: 'audio', OVERLAY: 'overlay' }
  function jobOperation(job: ProcessingJob): string {
    try {
      return JSON.parse(job.parameters ?? '{}').operation ?? ''
    } catch {
      return ''
    }
  }
  const runningByTab = computed(() => {
    const out: Partial<Record<typeof mode.value, { label: string }>> = {}
    for (const job of visibleJobs.value) {
      if (!isActiveJobStatus(job.status)) continue
      let op = ''
      try {
        op = JSON.parse(job.parameters ?? '{}').operation ?? ''
      } catch {
        // No tab to show it on.
      }
      const tab = JOB_TAB[op]
      if (tab && !out[tab]) out[tab] = { label: job.status === 'QUEUED' ? 'queued' : `${Math.round(job.progress)}%` }
    }
    return out
  })
  const runningCount = computed(() => visibleJobs.value.filter((j) => isActiveJobStatus(j.status)).length)
  function tabBadge(tab: typeof mode.value, dirty: boolean) {
    const running = runningByTab.value[tab]
    if (running)
      return {
        label: running.label,
        color: 'info' as const,
        size: 'xs' as const,
        icon: 'i-lucide-loader',
        ui: { leadingIcon: 'animate-spin motion-reduce:animate-none' }
      }
    return dirty ? DIRTY_BADGE : undefined
  }
  const tabItems = computed(() => [
    { label: 'Trim', value: 'trim', slot: 'trim' as const, icon: 'i-lucide-scissors', ui: TAB_TONES.trim.ui, badge: tabBadge('trim', trimDirty.value) },
    { label: 'Split', value: 'split', slot: 'split' as const, icon: 'i-lucide-split', ui: TAB_TONES.split.ui, badge: tabBadge('split', splitDirty.value) },
    {
      label: 'Audio',
      value: 'audio',
      slot: 'audio' as const,
      icon: 'i-lucide-audio-lines',
      ui: TAB_TONES.audio.ui,
      badge: tabBadge('audio', audioEdit.changed.value)
    },
    {
      label: 'Text',
      value: 'overlay',
      slot: 'overlay' as const,
      icon: 'i-lucide-type',
      ui: TAB_TONES.overlay.ui,
      badge: tabBadge('overlay', overlayEdit.state.layers.length > 0)
    },
    { label: 'Join', value: 'join', slot: 'join' as const, icon: 'i-lucide-film', ui: TAB_TONES.join.ui }
  ])

  function takeState() {
    const { selectedId: _a, ...audio } = audioEdit.state
    return {
      trim: {
        range: range.value,
        cropOn: cropOn.value,
        crop: { ...crop },
        cropAspect: cropAspect.value,
        followAction: followAction.value,
        scaleOn: scaleOn.value,
        scale: { ...scale },
        orient: { ...orient.value },
        cuts: cuts.value.map((c) => ({ ...c })),
        audio: trimAudio.value ? { ...trimAudio.value } : null,
        extend: extendOn.value,
        look: { ...look.value },
        motion: JSON.parse(JSON.stringify(motion.value)) as VideoMotion,
        extras: JSON.parse(JSON.stringify(extras.value)) as TrimExtras
      },
      split: segments.value,
      audio,
      overlay: overlayEdit.state.layers,
      captions: overlayEdit.state.captions ? (JSON.parse(JSON.stringify(overlayEdit.state.captions)) as BurnedCaptions) : null,
      join: { clips: joinEdit.state.clips }
    }
  }
  async function applyState(st: ReturnType<typeof takeState>) {
    range.value = st.trim.range
    cropOn.value = st.trim.cropOn
    Object.assign(crop, st.trim.crop)
    cropAspect.value = st.trim.cropAspect
    followAction.value = !!st.trim.followAction
    scaleOn.value = st.trim.scaleOn
    // Drafts saved before turning existed have no `orient`.
    orient.value = st.trim.orient ? { ...st.trim.orient } : { ...NO_ORIENTATION }
    Object.assign(scale, st.trim.scale)
    // Drafts saved before Cut out existed have no `cuts`.
    cuts.value = (st.trim.cuts ?? []).map((c) => ({ ...c }))
    // Same for added audio.
    trimAudio.value = st.trim.audio ? { ...st.trim.audio } : null
    extendOn.value = !!st.trim.extend
    // And a look.
    look.value = st.trim.look ? { ...PLAIN_LOOK, ...st.trim.look } : { ...PLAIN_LOOK }
    // And motion & effects.
    motion.value = sanitizeMotion(st.trim.motion)
    extras.value = sanitizeExtras(st.trim.extras)
    segments.value = st.split
    const { clips, ...audio } = st.audio
    // Drafts saved before extra sound tracks existed have neither of these.
    Object.assign(audioEdit.state, { tracks: [], keepSoundSpeed: false, volumeCurve: [], preset: 'NONE', deEss: false }, audio)
    audioEdit.state.clips = clips
    overlayEdit.state.layers = st.overlay
    // Drafts saved before burned-in subtitles have none.
    overlayEdit.state.captions = st.captions ? (JSON.parse(JSON.stringify(st.captions)) as BurnedCaptions) : null
    // Drafts saved before the Join tab existed have no `join`.
    if (st.join) Object.assign(joinEdit.state, st.join)
    if (!st.overlay.some((l) => l.id === overlayEdit.state.selectedId)) overlayEdit.state.selectedId = null
    // A changed audio source starts its clips over (useAudioEdit); put them back after that.
    await nextTick()
    audioEdit.state.clips = clips
  }
  // "Draft saved 14:32" next to Undo/Redo, so it is clear unrendered edits survive a reload.
  const draftSavedLabel = computed(() =>
    history.draftSavedAt.value ? new Date(history.draftSavedAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  )
  const history = useEditorHistory({
    take: takeState,
    apply: applyState,
    draftKey: () => `videolingo:editor-draft:${props.video.id}`,
    videoUrl: () => props.video.videoUrl ?? null
  })

  // Once the state is loaded (and again when the real duration arrives, which
  // fills in ranges and clips), that's the starting point: no undo past it,
  // and a saved draft is offered once.
  const draft = ref<EditorDraft | null>(null)
  let draftOffered = false
  function settle() {
    nextTick(() => {
      history.start()
      if (!draftOffered) {
        draftOffered = true
        draft.value = history.pendingDraft()
      }
    })
  }
  async function onRestoreDraft() {
    if (!draft.value) return
    await history.restoreDraft(draft.value)
    draft.value = null
  }
  const confirmDiscardDraft = ref(false)
  function onDiscardDraft() {
    history.discardDraft()
    draft.value = null
    confirmDiscardDraft.value = false
  }

  // ── Promote / discard ────────────────────────────────────────────────────────
  const CLIP_ICONS = CLIP_OPERATION_ICONS
  function replaces(clip: VideoClip) {
    return clip.operation === 'TRIM' || clip.operation === 'AUDIO' || clip.operation === 'OVERLAY'
  }
  function clipTitle(clip: VideoClip) {
    return clipLabel(clip)
  }
  const confirmPromote = ref<VideoClip | null>(null)
  const promoting = ref(false)
  async function onPromote() {
    if (!confirmPromote.value) return
    promoting.value = true
    try {
      const result = await promote(props.video.id, confirmPromote.value.id)
      if (result.kind === 'REPLACED') {
        toast.add({ title: 'Video replaced', description: "The edited clip is now the video's file.", color: 'success' })
        emit('replaced')
      } else {
        toast.add({ title: 'New video created', description: "It's disabled until you review and enable it.", color: 'success' })
        if (result.newVideoId) emit('created', result.newVideoId)
      }
      confirmPromote.value = null
      await load()
    } catch (err) {
      toast.add({ title: 'Could not apply the clip', description: apiErrorMessage(err), color: 'error' })
    } finally {
      promoting.value = false
    }
  }

  // ── Keep a result as a separate video ────────────────────────────────────────
  const asNewClip = ref<VideoClip | null>(null)
  const asNewTitle = ref('')
  const creatingNew = ref(false)
  function openAsNew(clip: VideoClip) {
    asNewTitle.value = suggestedNewTitle(props.video.title, clip.operation, clip.segmentIndex)
    asNewClip.value = clip
  }
  async function onCreateNew() {
    const clip = asNewClip.value
    if (!clip || !asNewTitle.value.trim()) return
    creatingNew.value = true
    try {
      const result = await promote(props.video.id, clip.id, { asNew: true, title: asNewTitle.value })
      asNewClip.value = null
      toast.add({ title: 'New video created', description: "It's disabled until you review and enable it.", color: 'success' })
      if (result.newVideoId) emit('created', result.newVideoId)
      await load()
    } catch (err) {
      toast.add({ title: 'Could not create the video', description: apiErrorMessage(err), color: 'error' })
    } finally {
      creatingNew.value = false
    }
  }

  // ── Several results at once ──────────────────────────────────────────────────
  // Handy after a split or a multi-format export: tick results, then add them all
  // as new videos or discard them. Extracted audio has no video to add, so it isn't tickable.
  const pickedClipIds = ref<number[]>([])
  const bulkBusy = ref(false)
  const confirmBulkDiscard = ref(false)
  const selectableClips = computed(() => (data.value?.clips ?? []).filter((c) => c.operation !== 'EXTRACT'))
  const pickedClips = computed(() => selectableClips.value.filter((c) => pickedClipIds.value.includes(c.id)))
  const allClipsPicked = computed(() => selectableClips.value.length > 0 && pickedClips.value.length === selectableClips.value.length)
  function pickClip(id: number, on: boolean) {
    pickedClipIds.value = on ? [...new Set([...pickedClipIds.value, id])] : pickedClipIds.value.filter((x) => x !== id)
  }
  function pickAllClips(v: boolean | 'indeterminate') {
    pickedClipIds.value = v === true ? selectableClips.value.map((c) => c.id) : []
  }
  async function onBulkAddAsNew() {
    const list = [...pickedClips.value]
    bulkBusy.value = true
    let done = 0
    let lastId: number | null = null
    try {
      for (const clip of list) {
        const result = await promote(props.video.id, clip.id, { asNew: true, title: suggestedNewTitle(props.video.title, clip.operation, clip.segmentIndex) })
        if (result.newVideoId) lastId = result.newVideoId
        done++
      }
      toast.add({
        title: `${done} new video${done === 1 ? '' : 's'} created`,
        description: "They're disabled until you review and enable them.",
        color: 'success'
      })
    } catch (err) {
      toast.add({ title: done ? `${done} created, then it stopped` : 'Could not create the videos', description: apiErrorMessage(err), color: 'error' })
    } finally {
      bulkBusy.value = false
      pickedClipIds.value = []
      await load()
      if (lastId && done === 1) emit('created', lastId)
    }
  }
  async function onBulkDiscard() {
    const list = [...pickedClips.value]
    confirmBulkDiscard.value = false
    bulkBusy.value = true
    let done = 0
    try {
      for (const clip of list) {
        await remove(props.video.id, clip.id)
        done++
      }
      toast.add({ title: `${done} result${done === 1 ? '' : 's'} discarded`, color: 'info' })
    } catch (err) {
      toast.add({ title: done ? `${done} discarded, then it stopped` : 'Could not discard the results', description: apiErrorMessage(err), color: 'error' })
    } finally {
      bulkBusy.value = false
      pickedClipIds.value = []
      await load()
    }
  }

  const compareClip = ref<VideoClip | null>(null)
  const previewClip = ref<VideoClip | null>(null)
  // Same two paths as the buttons on the row: a result that would replace the original is added as a new video with a title to check; a split segment is confirmed.
  function onPreviewAddNew() {
    const clip = previewClip.value
    if (!clip) return
    if (replaces(clip)) openAsNew(clip)
    else confirmPromote.value = clip
  }

  // ── First-run tip (a convenience only; storage can be blocked) ────────────────
  const TIP_KEY = 'videolingo:editor-tip-dismissed'
  const showTip = ref(false)
  onMounted(() => {
    try {
      showTip.value = !localStorage.getItem(TIP_KEY)
    } catch {
      showTip.value = false
    }
  })
  function dismissTip() {
    showTip.value = false
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {
      // It will show again next time; harmless.
    }
  }

  // ── Recipes: reuse a look on another video ───────────────────────────────────
  const recipes = useEditRecipes()
  const recipesOpen = ref(false)
  const recipeName = ref('')
  const currentRecipe = computed<EditRecipe | null>(() => {
    const a = audioEdit.state
    const recipe: EditRecipe = {
      frame: presetFromSettings(cropOn.value, cropAspect.value, scaleOn.value, scale),
      ...(orientActive.value ? { orient: { ...orient.value } } : {}),
      audio: audioDifferences({
        volume: a.volume,
        fadeInMs: a.fadeInMs,
        fadeOutMs: a.fadeOutMs,
        normalize: a.normalize,
        denoise: a.denoise,
        enhanceVoice: a.enhanceVoice,
        speed: a.speed,
        pitchSemitones: a.pitchSemitones,
        balance: a.balance,
        channels: a.channels,
        keepSoundSpeed: a.keepSoundSpeed,
        preset: a.preset,
        deEss: a.deEss
      }),
      layers: JSON.parse(JSON.stringify(overlayEdit.state.layers)) as RecipeLayer[]
    }
    return isRecipeEmpty(recipe) ? null : recipe
  })
  function onSaveRecipe() {
    const data = currentRecipe.value
    const name = recipeName.value.trim()
    if (!data || !name) return
    recipes.save(name, data)
    toast.add({ title: `Saved recipe “${name}”`, color: 'success' })
    recipeName.value = ''
  }
  function applyRecipe(r: EditRecipe, name: string) {
    if (r.frame) {
      cropOn.value = true
      setAspect(r.frame.aspect)
      scaleOn.value = true
      Object.assign(scale, { w: r.frame.w, h: r.frame.h })
    }
    if (r.orient) orient.value = { ...r.orient }
    // A recipe stands for the whole sound setup, so settings it leaves out go back to normal.
    Object.assign(audioEdit.state, fullAudio(r))
    if (r.layers.length) {
      overlayEdit.state.layers = []
      overlayEdit.addTemplate(JSON.parse(JSON.stringify(r.layers)))
    }
    recipesOpen.value = false
    toast.add({ title: `Applied “${name}”`, description: 'Undo (Ctrl/⌘+Z) brings the old settings back.', color: 'info' })
  }

  const confirmDiscardClip = ref<VideoClip | null>(null)
  async function onConfirmDiscardClip() {
    const clip = confirmDiscardClip.value
    confirmDiscardClip.value = null
    if (clip) await onDiscard(clip)
  }
  async function onDiscard(clip: VideoClip) {
    try {
      await remove(props.video.id, clip.id)
      await load()
    } catch (err) {
      toast.add({ title: 'Could not discard the clip', description: apiErrorMessage(err), color: 'error' })
    }
  }

  function formatMsShort(ms: number) {
    return formatDuration(Math.round(ms / 1000))
  }

  return {
    // The props, for the tab templates.
    video: toRef(props, 'video'),
    canWrite: toRef(props, 'canWrite'),
    resultsCard,
    presetNameInput,
    presetFileInput,
    renameInput,
    segmentStrip,
    toast,
    overview,
    startTrim,
    startSplit,
    startCut,
    autoCrop,
    promote,
    remove,
    data,
    error,
    announceNewAudioClips,
    freshClipIds,
    markFreshClips,
    load,
    scrollToResults,
    onQueued,
    mode,
    HEADER_TONES,
    TAB_KEYS,
    tabKeysHint,
    EDITOR_SHORTCUTS,
    preview,
    currentMs,
    durationMs,
    naturalWidth,
    naturalHeight,
    onTime,
    onDuration,
    zoomBox,
    MAX_ZOOM,
    zoom,
    pan,
    hovering,
    spaceHeld,
    panning,
    cropActive,
    showGuides,
    guideBox,
    clampPan,
    zoomAt,
    zoomBy,
    resetZoom,
    onPreviewWheel,
    swallowNextClick,
    onPanStart,
    cropLayer,
    CONTROL_BAR_PX,
    onQuickCropStart,
    isTyping,
    onKeyDown,
    onKeyUp,
    stage,
    stageFullscreen,
    fitStyle,
    onFullscreenChange,
    range,
    extendOn,
    trimLimit,
    extension,
    cropOn,
    crop,
    onCropToggle,
    ASPECTS,
    cropAspect,
    setAspect,
    cropFull,
    BUILTIN_PRESETS,
    PRESET_TONES,
    CUSTOM_PRESET_TONE,
    presetTone,
    exportPresets,
    EXPORT_PRESETS,
    applyPreset,
    activePreset,
    multiExport,
    multiKeys,
    startingMulti,
    multiPresets,
    isPresetOn,
    onPresetClick,
    queueSlots,
    multiError,
    multiSummary,
    onStartMulti,
    togglePreset,
    savingPreset,
    presetName,
    MAX_PRESET_NAME,
    presetToSave,
    takenPresetNames,
    presetRenamedTo,
    presetsFull,
    openSavePreset,
    onSavePreset,
    onExportPresets,
    onImportPresets,
    renamingId,
    renameText,
    startRename,
    otherPresetNames,
    renameClash,
    onRenamePreset,
    removePreset,
    cropFieldsOpen,
    orient,
    orientActive,
    previewOriented,
    previewOrientStyle,
    orientSampleTransform,
    resetTrim,
    TRIM_EDGES,
    setEdge,
    nudgeEdge,
    typeEdge,
    autoCentering,
    onAutoCenter,
    scaleOn,
    scale,
    onScaleToggle,
    resizeFrom,
    resizeOptions,
    scaleNotes,
    scaleLock,
    setScaleSide,
    pickScale,
    matchScaleShape,
    trimError,
    starting,
    onStartTrim,
    cuts,
    motion,
    extras,
    followAction,
    blurEditing,
    blursShown,
    lookCompare,
    lookCompareShown,
    trimAudio,
    look,
    cutStarting,
    onStartCut,
    segments,
    SEGMENT_COLORS,
    segmentBars,
    resetSplit,
    selectedSegment,
    selectSegment,
    removeSegment,
    rowProblem,
    segmentEndSeconds,
    segmentLength,
    typeSegment,
    splitTarget,
    canSplitHere,
    splitAtPlayhead,
    uncoveredMs,
    splitSummary,
    dragBoundary,
    nudgeBoundary,
    everySeconds,
    everyRows,
    splitEvery,
    evenPreview,
    splitSizeHint,
    customParts,
    evenPartsMax,
    tooManyPartsHint,
    customPartsValid,
    splitEvenly,
    splitError,
    onStartSplit,
    visibleJobs,
    can,
    jobsApi,
    canCancel,
    canRetry,
    retryingId,
    onRetryJob,
    cancellingId,
    onCancelJob,
    busy,
    JOB_LABELS,
    jobLabel,
    reset,
    tabKey,
    MODES,
    audioEdit,
    overlayEdit,
    joinEdit,
    trimDirty,
    splitDirty,
    DIRTY_BADGE,
    trimSizeHint,
    trimSummary,
    TAB_TONES,
    JOB_TAB,
    jobOperation,
    runningByTab,
    runningCount,
    tabBadge,
    tabItems,
    takeState,
    applyState,
    draftSavedLabel,
    history,
    draft,
    settle,
    onRestoreDraft,
    confirmDiscardDraft,
    onDiscardDraft,
    CLIP_ICONS,
    replaces,
    clipTitle,
    confirmPromote,
    promoting,
    onPromote,
    asNewClip,
    asNewTitle,
    creatingNew,
    openAsNew,
    onCreateNew,
    pickedClipIds,
    bulkBusy,
    confirmBulkDiscard,
    selectableClips,
    pickedClips,
    allClipsPicked,
    pickClip,
    pickAllClips,
    onBulkAddAsNew,
    onBulkDiscard,
    compareClip,
    previewClip,
    onPreviewAddNew,
    TIP_KEY,
    showTip,
    dismissTip,
    recipes,
    recipesOpen,
    recipeName,
    currentRecipe,
    onSaveRecipe,
    applyRecipe,
    confirmDiscardClip,
    onConfirmDiscardClip,
    onDiscard,
    formatMsShort
  }
}

const CLIP_EDITOR_KEY: InjectionKey<ReturnType<typeof useClipEditor>> = Symbol('clip-editor')

/** Makes the editor and hands it to the tab components below VideoClipEditor. */
export function provideClipEditor(props: ClipEditorProps, emit: ClipEditorEmit) {
  const editor = useClipEditor(props, emit)
  provide(CLIP_EDITOR_KEY, editor)
  return editor
}

/** The editor, in one of its tab components. */
export function useClipEditorContext() {
  const editor = inject(CLIP_EDITOR_KEY)
  if (!editor) throw new Error('A clip editor tab must sit inside VideoClipEditor')
  return editor
}
