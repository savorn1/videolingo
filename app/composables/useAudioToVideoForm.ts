// The state and actions of the "Video from audio" page (app/pages/videos/from-audio.vue). The page
// provides one form to its step components (app/components/audio-video/*), which inject it. Each audio
// file (and the optional pictures) is uploaded straight to storage first; then the server makes each video
// in a background job, and the page hands over to the video (one file) or the list (several).
import type { InjectionKey } from 'vue'
import type { SeriesLook } from '#shared/utils/seriesLook'
import { canDrawFromAudio } from '#shared/utils/waveSamples'
import { offeredWaveforms } from '#shared/utils/mediaRules'
import { MAX_PREVIEW_BYTES } from '~/composables/useAudioPeaks'
import type { WaveLook } from '#shared/utils/waveTemplates'

import {
  audioFileProblem,
  clampPartMinutes,
  estimatedParts,
  frameSizeLabel,
  partTitle,
  recordingSlides,
  defaultWaveHeight,
  type BurnPosition,
  type BurnStyle,
  type VideoShape,
  batchProblem,
  coverFileProblem,
  DEFAULT_BACKGROUND,
  DEFAULT_RESOLUTION,
  nextToUpload,
  normalizeHexColor,
  sanitizeLook,
  type SavedLook,
  submitBlocker,
  sortDroppedFiles,
  submitBlockerStep,
  uniqueTitles,
  WAVEFORM_STYLES,
  waveformPlacement,
  type VideoResolution,
  type WaveformStyle
} from '#shared/utils/audioVideo'
import { uploadToStorage, UploadInterruptedError, type ResumableUpload } from '~/composables/useVideos'
import { formatTimecode, parseTimecode } from '#shared/utils/transport'
import { MAX_SLIDES, nextSlideStart, slideIndexAt, slideProblem, slidesBeyond, spreadEvenly, swapContents } from '#shared/utils/slides'
import { cardRequest, cardsProblem, chaptersForPart, highlightTitle, paletteFromPixels, tidyChapters, type ChapterMark } from '#shared/utils/audioVideoExtras'
import { fromDateTimeLocal, SCHEDULE_STEPS, schedulePresets, scheduleSeries, toDateTimeLocal } from '#shared/utils/publishSchedule'

interface Item {
  id: number
  file: File | null
  name: string
  size: number
  status: 'queued' | 'uploading' | 'ready' | 'error'
  progress: number
  key: string
  error: string
  previewUrl: string
  durationSeconds: number | null
  title: string
  /** Its own picture (an OVERLAY upload) used instead of the shared ones: from the file's cover art, or chosen. */
  coverKey: string | null
  coverUrl: string | null
  coverFromFile: boolean
  coverUploading: boolean
  /** Where a large upload stopped, so "Try again" carries on from there. */
  resume: ResumableUpload | null
  /** Chapters written in the file (ID3 CHAP), shown on the picture and kept as chapter markers. */
  chapters: ChapterMark[]
}
interface Slide {
  id: number
  key: string
  name: string
  previewUrl: string
  /** When this picture appears, in ms; the first is always 0. */
  startMs: number
}

export function useAudioToVideoForm() {
  const videos = useVideos()
  const collections = useCollections()
  const toast = useToast()
  const { settings: clientSettings } = useClientSettings()
  const maxUploadMb = computed(() => clientSettings.value?.maxVideoUploadMb ?? 2048)
  const maxCategories = computed(() => clientSettings.value?.maxCategoriesPerVideo ?? 10)
  const requireCategory = computed(() => clientSettings.value?.requireCategory ?? false)

  const items = ref<Item[]>([])
  const slides = ref<Slide[]>([])
  const picUploading = ref(false)
  const picProgress = ref(0)
  const previewSeconds = ref(0)
  const background = ref<string>(DEFAULT_BACKGROUND)
  const backgroundText = ref<string>(DEFAULT_BACKGROUND)
  const resolution = ref<VideoResolution>(DEFAULT_RESOLUTION)
  const waveform = ref<WaveformStyle>('NONE')
  const waveAuto = ref(true)
  const waveColor = ref('#ffffff')
  const titleCard = ref(false)
  const normalize = ref(false)
  const denoise = ref(false)
  const description = ref('')
  const language = ref<string | undefined>(undefined)
  const categoryIds = ref<number[]>([])
  const collectionId = ref<number | undefined>(undefined)
  const transcribe = ref(false)
  const shape = ref<VideoShape>('WIDE')
  const motion = ref(false)
  const crossfade = ref(false)
  const spreadPerRecording = ref(false)
  const stripText = ref('')
  const logoKey = ref<string | null>(null)
  const logoUrl = ref<string | null>(null)
  const logoUploading = ref(false)
  const logoProgress = ref(0)
  const trimSilence = ref(false)
  /** The waveform's height, % of the picture; null = the style's usual height (which moves with the style). */
  const waveHeight = ref<number | null>(null)
  const waveHeightShown = computed(() => waveHeight.value ?? defaultWaveHeight(waveform.value))
  function setWaveHeight(v: number) {
    waveHeight.value = v === defaultWaveHeight(waveform.value) ? null : v
  }
  const chapters = ref(false)
  const partMinutes = ref(10)
  const burnSubtitles = ref(false)
  const subtitleStyle = ref<BurnStyle>('BOX')
  const subtitlePosition = ref<BurnPosition>('BOTTOM')
  /** A translation into this language as a smaller second line of the burned-in subtitles. */
  const secondLanguage = ref<string | undefined>(undefined)
  const blurBackdrop = ref(false)
  const progressBar = ref(false)
  /** Use the chapters found in the files: titles on the picture and chapter markers. */
  const useChapters = ref(true)
  const intro = reactive({ text: '', seconds: 3 })
  const outro = reactive({ text: '', seconds: 3 })
  const cardsError = computed(() => cardsProblem(intro, outro))
  /** Music under the recordings (an AUDIO upload), quieter under speech when ducked. */
  const music = ref<{ key: string; name: string } | null>(null)
  const musicUploading = ref(false)
  const musicProgress = ref(0)
  const musicVolume = ref(0.15)
  const musicDuck = ref(true)
  /** Also make a short tall video of each recording's liveliest stretch. */
  const highlight = ref(false)
  const highlightSeconds = ref(45)
  /** Schedule the videos to enable themselves one after another. */
  const schedule = ref(false)
  const scheduleStart = ref(toDateTimeLocal(schedulePresets(new Date())[1]!.at))
  const scheduleStep = ref<number>(SCHEDULE_STEPS[1].value)

  const errors = ref<Record<string, string>>({})
  const saveError = ref('')
  const saving = ref(false)
  const submitted = ref(false)
  const dragging = ref(false)

  const languageItems = computed(() => [{ label: 'Not set', value: undefined }, ...languageOptions(language.value)])
  const categoryItems = computed(() => categoryOptions(categoryIds.value).map((o) => ({ label: o.label, value: o.value, disabled: o.disabled })))
  const collectionItems = ref<{ label: string; value: number | undefined }[]>([{ label: 'None', value: undefined }])
  const collectionsLoading = ref(false)
  onMounted(async () => {
    collectionsLoading.value = true
    try {
      const res = await collections.list({ size: 100 })
      collectionItems.value = [{ label: 'None', value: undefined }, ...res.data.map((c) => ({ label: c.title, value: c.id }))]
    } catch {
      // The picker just stays on "None".
    } finally {
      collectionsLoading.value = false
    }
  })

  // A transcript needs to know the language; drop the choice if it goes away.
  watch(language, (l) => {
    if (!l) transcribe.value = false
  })
  watch(transcribe, (on) => {
    if (!on) burnSubtitles.value = false
  })
  watch([language, burnSubtitles], () => {
    if (!burnSubtitles.value || secondLanguage.value === language.value) secondLanguage.value = undefined
  })
  const chapterCount = computed(() => readyItems.value.reduce((n, i) => n + i.chapters.length, 0))
  // The strip moves to the top when a waveform runs along the bottom (as on the server).
  const stripOnTop = computed(() => waveform.value !== 'NONE' && waveformPlacement(waveform.value) === 'BOTTOM')
  const subtitleClash = computed(() => {
    if (subtitlePosition.value === 'BOTTOM' && waveform.value !== 'NONE' && waveformPlacement(waveform.value) === 'BOTTOM')
      return 'The waveform also runs along the bottom — the subtitles may sit on it. Try Top.'
    if (subtitlePosition.value === 'BOTTOM' && stripText.value.trim() && !stripOnTop.value) return 'The strip is at the bottom too — try Top.'
    if (subtitlePosition.value === 'TOP' && (logoKey.value || (stripText.value.trim() && stripOnTop.value)))
      return 'The logo or the strip is at the top too — the subtitles may overlap them.'
    return ''
  })
  const partsOf = (i: Item) => (chapters.value ? estimatedParts(i.durationSeconds, partMinutes.value) : 1)
  const longItems = computed(() => readyItems.value.filter((i) => partsOf(i) > 1).length)
  /** Videos that will be made: one per recording, or its parts when long recordings are split (an estimate — pauses can move it by one). */
  const videoCount = computed(() => readyItems.value.reduce((n, i) => n + partsOf(i), 0))
  const videoCountLabel = computed(() => `${longItems.value ? 'about ' : ''}${videoCount.value}`)
  function commitPartMinutes() {
    partMinutes.value = clampPartMinutes(partMinutes.value)
  }
  // The preview shows one recording (its title, own picture and length): the one chosen, else the first.
  const previewItemId = ref<number | null>(null)
  const previewItem = computed(() => readyItems.value.find((i) => i.id === previewItemId.value) ?? readyItems.value[0] ?? null)
  const previewOwnCover = computed(() => previewItem.value?.coverUrl ?? null)
  // The title goes on the picture only when there are no pictures to show.
  watch(
    () => slides.value.length,
    (n) => {
      if (n) titleCard.value = false
    }
  )

  const readyItems = computed(() => items.value.filter((i) => i.status === 'ready'))

  // ── The pictures: times, checks and the preview ──────────────────────────────
  const slideStarts = computed(() => slides.value.map((sl) => sl.startMs))
  const slideError = computed(() => slideProblem(slideStarts.value))
  /** The shortest recording, which the pictures' times are judged against. */
  const shortestSeconds = computed(() => {
    const known = readyItems.value.map((i) => i.durationSeconds).filter((d): d is number => !!d)
    return known.length ? Math.min(...known) : null
  })
  const beyond = computed(() => slidesBeyond(slideStarts.value, shortestSeconds.value))
  const spreadStarts = computed(() => (shortestSeconds.value ? spreadEvenly(slides.value.length, shortestSeconds.value) : null))
  const previewMax = computed(() => previewItem.value?.durationSeconds ?? 0)
  watch(previewMax, (max) => {
    if (previewSeconds.value > max) previewSeconds.value = Math.floor(max)
  })
  const shownIndex = computed(() => slideIndexAt(slideStarts.value, previewSeconds.value * 1000))
  const shownSlide = computed(() => slides.value[shownIndex.value] ?? null)
  const uploadingAny = computed(() => picUploading.value || musicUploading.value || items.value.some((i) => i.status === 'queued' || i.status === 'uploading'))
  const blocker = computed(
    () =>
      submitBlocker({
        files: items.value.filter((i) => i.status !== 'error').length,
        uploading:
          items.value.filter((i) => i.status === 'queued' || i.status === 'uploading').length + (picUploading.value ? 1 : 0) + (musicUploading.value ? 1 : 0),
        untitled: readyItems.value.filter((i) => !i.title.trim()).length,
        slideError: slideError.value,
        missingCategory: requireCategory.value && !categoryIds.value.length
      }) ?? cardsError.value
  )
  /** The step to look at for what blocks making the videos. */
  const blockerStep = computed(() =>
    blocker.value
      ? (submitBlockerStep({
          files: items.value.filter((i) => i.status !== 'error').length,
          audioUploading: items.value.filter((i) => i.status === 'queued' || i.status === 'uploading').length,
          picturesUploading: picUploading.value,
          untitled: readyItems.value.filter((i) => !i.title.trim()).length,
          slideError: slideError.value,
          missingCategory: requireCategory.value && !categoryIds.value.length
        }) ?? (cardsError.value ? 2 : null))
      : null
  )
  /** Brings a step's card into view (instantly when the user prefers less motion); returns it. */
  function scrollToStep(step: number): HTMLElement | null {
    const card = document.getElementById(`step-${step}`)
    card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    return card
  }
  const canSubmit = computed(() => !blocker.value && !saving.value && readyItems.value.length > 0)
  const submitLabel = computed(() => {
    if (uploadingAny.value) return 'Waiting for the uploads…'
    return videoCount.value > 1 ? `Make ${videoCountLabel.value} videos` : 'Make the video'
  })

  const selectedSize = computed(() => frameSizeLabel(resolution.value, shape.value))
  const readySummary = computed(() => {
    const parts = [`${videoCountLabel.value} video${videoCount.value === 1 ? '' : 's'}`, totalLength.value, selectedSize.value]
    if (waveform.value !== 'NONE') parts.push(WAVEFORM_STYLES.find((w) => w.value === waveform.value)?.label.toLowerCase() ?? 'waveform')
    if (slides.value.length > 1) parts.push(`${slides.value.length} pictures`)
    return `Ready: ${parts.filter((p) => p && p !== '—').join(' · ')}`
  })

  // ── Remember the look between visits ─────────────────────────────────────────
  // Background, size, waveform and sound options are usually the same for a whole series, so they are
  // kept with the user's other synced preferences and put back next time.
  const { load: loadPrefs, appValue, setApp } = useLearnerPrefs()
  const LOOK_KEY = 'audioVideoLook'
  let lookRestored = false
  onMounted(async () => {
    await loadPrefs()
    const saved = appValue<unknown>(LOOK_KEY, null)
    if (saved) applyLook(sanitizeLook(saved))
    lookRestored = true
  })
  function applyLook(look: SavedLook) {
    setBackground(look.background)
    resolution.value = look.resolution
    waveform.value = look.waveform
    waveAuto.value = look.waveAuto
    waveColor.value = look.waveColor
    normalize.value = look.normalize
    denoise.value = look.denoise
    shape.value = look.shape
    motion.value = look.motion
    crossfade.value = look.crossfade
    trimSilence.value = look.trimSilence
    waveHeight.value = look.waveHeightPct
    blurBackdrop.value = look.blurBackdrop
    progressBar.value = look.progressBar
  }
  function currentLook(): SavedLook {
    return {
      background: background.value,
      resolution: resolution.value,
      waveform: waveform.value,
      waveAuto: waveAuto.value,
      waveColor: waveColor.value,
      normalize: normalize.value,
      denoise: denoise.value,
      shape: shape.value,
      motion: motion.value,
      crossfade: crossfade.value,
      trimSilence: trimSilence.value,
      waveHeightPct: waveHeight.value,
      blurBackdrop: blurBackdrop.value,
      progressBar: progressBar.value
    }
  }
  // ── Saved looks for a series: the look plus the strip, the title card and the picture spread ──
  function currentSeriesLook(): SeriesLook {
    return {
      ...currentLook(),
      stripText: stripText.value,
      titleCard: titleCard.value,
      spreadPerRecording: spreadPerRecording.value,
      introText: intro.text,
      outroText: outro.text
    }
  }
  function applySeriesLook(look: SeriesLook) {
    applyLook(look)
    stripText.value = look.stripText
    // The title card is only used without pictures (see the watch on slides).
    titleCard.value = look.titleCard && !slides.value.length
    spreadPerRecording.value = look.spreadPerRecording
    intro.text = look.introText
    outro.text = look.outroText
  }
  watch(
    [background, resolution, waveform, waveAuto, waveColor, normalize, denoise, shape, motion, crossfade, trimSilence, waveHeight, blurBackdrop, progressBar],
    () => {
      if (!lookRestored) return // still the defaults; don't overwrite what was saved
      setApp(LOOK_KEY, currentLook())
    }
  )
  const totalLength = computed(() => {
    const total = readyItems.value.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0)
    return total ? formatDuration(total) : '—'
  })
  // Measured on a laptop: 10 minutes of audio rendered in about 15 s (still) to 27 s (waveform at 1080p).
  // These rates allow about twice that for a slower server. Only the render is counted: the uploads and
  // any wait behind other jobs (the worker does one job at a time) come on top.
  const renderNote = computed(() => {
    const total = readyItems.value.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0)
    if (!total) return '—'
    const perSecond = waveform.value === 'NONE' ? 0.05 : 0.08
    const seconds = Math.round(total * perSecond)
    return seconds < 60 ? 'under a minute' : `about ${Math.round(seconds / 60)} min`
  })

  // Colours for the preview
  const darkBackground = computed(() => {
    const n = parseInt(background.value.slice(1), 16)
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.55
  })
  const textColor = computed(() => (darkBackground.value ? '#ffffff' : '#111111'))
  // The look as it is set now (what a template saves and what marks a template as chosen).
  const currentWaveLook = computed<WaveLook | null>(() =>
    waveform.value === 'NONE' ? null : { waveform: waveform.value, waveColor: waveAuto.value ? textColor.value : waveColor.value, background: background.value }
  )
  function applyWaveLook(look: WaveLook) {
    waveform.value = look.waveform
    waveAuto.value = false
    waveColor.value = look.waveColor
    setBackground(look.background)
  }
  // ── How close the preview is ─────────────────────────────────────────────────
  // The moving sketch is drawn from the first seconds of the user's own sound (decoded in the browser) where the
  // style allows; a test render asks the server for a few real seconds. Both are guides — the final video is drawn
  // from the whole sound.
  const TEST_RENDER_SECONDS = 5
  const audioPeaks = useAudioPeaks()
  // Items let go of their File once uploaded, so the first one is kept here (only while it is small enough to read) for the preview.
  const previewFile = ref<File | null>(null)
  const firstFile = computed(() => previewFile.value)
  watch(previewFile, (f) => audioPeaks.load(f))
  watch(
    () => items.value.length,
    (n) => {
      if (n === 0) previewFile.value = null
    }
  )
  const previewFromAudio = computed(() => !!audioPeaks.peaks.value && canDrawFromAudio(waveform.value))
  const previewNote = computed(() => {
    if (!firstFile.value && items.value.length) return 'The preview is a generic sketch here. Use the test render to see your own sound.'
    if (!firstFile.value) return 'Add an audio file and the preview will move with your own sound.'
    if (audioPeaks.state.value === 'reading') return 'Reading your audio…'
    if (audioPeaks.state.value === 'unavailable')
      return 'This file is too large (or not readable here) to draw live — the preview is a generic sketch. Use the test render.'
    if (waveform.value === 'STEREO') return 'Stereo needs both channels apart, so the preview is a generic sketch. Use the test render to see it.'
    if (!canDrawFromAudio(waveform.value))
      return `${waveform.value === 'BARS' ? 'Bars' : 'Spectrum'} need a frequency analysis, so the preview is a generic sketch. Use the test render to see it.`
    return 'Drawn live from the first seconds of your own audio, at the same speed the video will use.'
  })
  const testAudioKey = computed(() => readyItems.value[0]?.key ?? '')
  const testRendering = ref(false)
  const testRender = ref<{ url: string; signature: string } | null>(null)
  const testSignature = () =>
    JSON.stringify([
      testAudioKey.value,
      background.value,
      waveform.value,
      waveAuto.value ? null : waveColor.value,
      normalize.value,
      denoise.value,
      waveHeight.value
    ])
  const testRenderStale = computed(() => !!testRender.value && testRender.value.signature !== testSignature())
  async function onTestRender() {
    if (!testAudioKey.value || testRendering.value) return
    testRendering.value = true
    const signature = testSignature()
    try {
      const result = await videos.previewFromAudio({
        audioKey: testAudioKey.value,
        background: background.value,
        waveform: waveform.value,
        waveColor: waveAuto.value ? undefined : waveColor.value,
        normalize: normalize.value || undefined,
        denoise: denoise.value || undefined,
        waveHeightPct: waveHeight.value ?? undefined
      })
      testRender.value = { url: result.url, signature }
    } catch (err) {
      toast.add({ title: 'Could not make the test render', description: apiErrorMessage(err), color: 'error' })
    } finally {
      testRendering.value = false
    }
  }

  const customOpen = ref(false)
  // Only the styles this server can draw (an older server lacks the newest); a remembered style it lacks falls back to none.
  const offeredStyles = computed(() => offeredWaveforms(clientSettings.value?.mediaRules?.waveforms))
  watch([offeredStyles, waveform], () => {
    if (!offeredStyles.value.includes(waveform.value)) waveform.value = 'NONE'
  })
  const waveDrawColor = computed(() => (waveAuto.value ? textColor.value : waveColor.value))
  const previewTitle = computed(() => previewItem.value?.title.trim() || items.value[0]?.title.trim() || 'Your title here')

  function setBackground(value: string) {
    const hex = normalizeHexColor(value)
    if (!hex) return
    background.value = hex
    backgroundText.value = hex
  }
  function commitBackgroundText() {
    const hex = normalizeHexColor(backgroundText.value)
    if (hex) setBackground(hex)
    else backgroundText.value = background.value // put the last good colour back
  }

  /** The sound's length, read in the browser so it can be shown before anything is made. */
  function readDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const el = new Audio()
      const done = (v: number | null) => {
        URL.revokeObjectURL(url)
        resolve(v)
      }
      el.preload = 'metadata'
      el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : null)
      el.onerror = () => done(null)
      el.src = url
    })
  }

  // ── The audio files ──────────────────────────────────────────────────────────
  let nextId = 1
  function addFiles(files: File[]) {
    errors.value.audio = ''
    const problem = batchProblem(items.value.length + files.length)
    if (problem) {
      errors.value.audio = problem
      return
    }
    const rejected: string[] = []
    for (const file of files) {
      const fileProblem = audioFileProblem(file, maxUploadMb.value)
      if (fileProblem) {
        rejected.push(`${file.name}: ${fileProblem}`)
        continue
      }
      items.value.push({
        id: nextId++,
        file,
        name: file.name,
        size: file.size,
        status: 'queued',
        progress: 0,
        key: '',
        error: '',
        previewUrl: URL.createObjectURL(file),
        durationSeconds: null,
        title: titleFromFileName(file.name),
        coverKey: null,
        coverUrl: null,
        coverFromFile: false,
        coverUploading: false,
        resume: null,
        chapters: []
      })
    }
    if (rejected.length) errors.value.audio = rejected.join(' · ')
    pump()
  }
  function onPickFiles(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length) addFiles(files)
  }
  // Counted, because entering a child fires dragleave on its parent; only file drags show the overlay.
  let dragDepth = 0
  function onDragEnter(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('Files')) return
    dragDepth++
    dragging.value = true
  }
  function onDragLeave() {
    if (!dragging.value) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (!dragDepth) dragging.value = false
  }
  function onDrop(event: DragEvent) {
    dragDepth = 0
    dragging.value = false
    const { audio, pictures } = sortDroppedFiles(Array.from(event.dataTransfer?.files ?? []))
    if (audio.length) addFiles(audio)
    if (pictures.length) addPictures(pictures)
  }

  /** Starts waiting files, up to PARALLEL_UPLOADS at once; each one that finishes starts the next. */
  function pump() {
    for (let i = nextToUpload(items.value.map((x) => x.status)); i !== null; i = nextToUpload(items.value.map((x) => x.status))) {
      const item = items.value[i]!
      if (!item.file) {
        item.status = 'error'
        item.error = 'The file is no longer available — remove it and add it again'
        continue
      }
      uploadOne(item)
    }
  }
  async function uploadOne(item: Item) {
    if (!item.file) return
    item.status = 'uploading'
    item.progress = 0
    if (!previewFile.value && item.file.size <= MAX_PREVIEW_BYTES) previewFile.value = item.file
    try {
      const file = item.file
      const [seconds, tags] = await Promise.all([readDuration(file), readAudioTags(file)])
      item.durationSeconds = seconds
      // The title written in the file, unless one was already typed.
      if (tags.title && item.title === titleFromFileName(item.name)) item.title = tags.title.slice(0, 200)
      if (tags.chapters?.length) item.chapters = tidyChapters(tags.chapters)
      const { key } = await videos.uploadFile('AUDIO', file, { onProgress: (f) => (item.progress = f), resume: item.resume })
      item.key = key
      item.resume = null
      item.status = 'ready'
      item.file = null
      // Its cover art becomes its own picture (unless one was chosen meanwhile).
      if (tags.cover && !item.coverKey) {
        const ext = tags.cover.mime === 'image/png' ? 'png' : tags.cover.mime === 'image/webp' ? 'webp' : 'jpg'
        await setItemPicture(item, new File([new Uint8Array(tags.cover.data)], `cover.${ext}`, { type: tags.cover.mime }), true)
      }
    } catch (err) {
      item.status = 'error'
      if (err instanceof UploadInterruptedError) {
        item.resume = err.resume
        item.error = `The upload stopped at ${Math.round(item.progress * 100)}% (${err.message}). Trying again carries on from there.`
      } else item.error = `Could not upload: ${apiErrorMessage(err)}`
    }
    pump()
  }
  function retryItem(id: number) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    item.status = 'queued'
    item.error = ''
    pump()
  }
  function removeItem(id: number) {
    const i = items.value.findIndex((x) => x.id === id)
    if (i === -1) return
    // The preview was drawn from the first file; with it gone, it is only a sketch again.
    if (i === 0) previewFile.value = null
    if (playingId.value === id) stopPlaying()
    URL.revokeObjectURL(items.value[i]!.previewUrl)
    items.value.splice(i, 1)
  }
  function moveItem(index: number, by: -1 | 1) {
    const j = index + by
    if (j < 0 || j >= items.value.length) return
    const next = [...items.value]
    ;[next[index], next[j]] = [next[j]!, next[index]!]
    items.value = next
  }

  // ── Listening to a file before making it ─────────────────────────────────────
  let player: HTMLAudioElement | null = null
  const playingId = ref<number | null>(null)
  function stopPlaying() {
    player?.pause()
    player = null
    playingId.value = null
  }
  function togglePlay(item: Item) {
    const same = playingId.value === item.id
    stopPlaying()
    if (same) return
    const el = new Audio(item.previewUrl)
    el.onended = () => stopPlaying()
    player = el
    playingId.value = item.id
    el.play().catch(() => {
      if (player === el) stopPlaying()
    })
  }

  // ── The pictures ─────────────────────────────────────────────────────────────
  let nextSlideId = 1
  function onPickPictures(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length) addPictures(files)
  }
  async function addPictures(files: File[]) {
    if (picUploading.value) {
      errors.value.cover = 'Wait for the pictures being uploaded, then add more'
      return
    }
    errors.value.cover = ''
    const room = MAX_SLIDES - slides.value.length
    if (files.length > room) errors.value.cover = `At most ${MAX_SLIDES} pictures; the first ${room} were used`
    const rejected: string[] = []
    picUploading.value = true
    try {
      // One at a time, in the order chosen, so each gets the next time slot.
      for (const file of files.slice(0, Math.max(0, room))) {
        const problem = coverFileProblem(file)
        if (problem) {
          rejected.push(`${file.name}: ${problem}`)
          continue
        }
        picProgress.value = 0
        try {
          const ticket = await videos.requestUpload('OVERLAY', file)
          await uploadToStorage(ticket, file, (f) => (picProgress.value = f))
          slides.value.push({
            id: nextSlideId++,
            key: ticket.key,
            name: file.name,
            previewUrl: URL.createObjectURL(file),
            startMs: nextSlideStart(slideStarts.value, shortestSeconds.value)
          })
        } catch (err) {
          rejected.push(`${file.name}: could not upload (${apiErrorMessage(err)})`)
        }
      }
    } finally {
      picUploading.value = false
    }
    if (rejected.length) errors.value.cover = [errors.value.cover, ...rejected].filter(Boolean).join(' · ')
  }

  /** Typed times ("1:23", "1:23.5"); a value that isn't a time puts the old one back. */
  function typeStart(id: number, event: Event) {
    const slide = slides.value.find((sl) => sl.id === id)
    const input = event.target as HTMLInputElement
    if (!slide) return
    const ms = parseTimecode(input.value)
    if (ms === null) toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
    else slide.startMs = ms
    input.value = formatTimecode(slide.startMs)
  }
  function movePicture(index: number, by: -1 | 1) {
    slides.value = swapContents(slides.value, index, index + by)
  }
  function removeSlide(id: number) {
    const i = slides.value.findIndex((sl) => sl.id === id)
    if (i === -1) return
    URL.revokeObjectURL(slides.value[i]!.previewUrl)
    const rest = slides.value.filter((sl) => sl.id !== id)
    // Every other picture keeps its own time. If the first one went, the next one becomes the first, which starts at 0:00.
    slides.value = rest.map((sl, n) => (n === 0 ? { ...sl, startMs: 0 } : sl))
  }
  function spread() {
    const starts = spreadStarts.value
    if (starts) slides.value = slides.value.map((sl, i) => ({ ...sl, startMs: starts[i]! }))
  }
  onBeforeUnmount(() => {
    stopPlaying()
    items.value.forEach((i) => {
      URL.revokeObjectURL(i.previewUrl)
      if (i.coverUrl) URL.revokeObjectURL(i.coverUrl)
    })
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
    slides.value.forEach((sl) => URL.revokeObjectURL(sl.previewUrl))
  })

  // ── A recording's own picture, and the logo ──────────────────────────────────
  async function setItemPicture(item: Item, file: File, fromFile: boolean) {
    const problem = coverFileProblem(file)
    if (problem) {
      if (!fromFile) toast.add({ title: 'Can’t use that picture', description: problem, color: 'warning' })
      return
    }
    item.coverUploading = true
    try {
      const ticket = await videos.requestUpload('OVERLAY', file)
      await uploadToStorage(ticket, file)
      if (item.coverUrl) URL.revokeObjectURL(item.coverUrl)
      item.coverKey = ticket.key
      item.coverUrl = URL.createObjectURL(file)
      item.coverFromFile = fromFile
    } catch (err) {
      if (!fromFile) toast.add({ title: 'Could not upload the picture', description: apiErrorMessage(err), color: 'error' })
    } finally {
      item.coverUploading = false
    }
  }
  async function onPickItemPicture(id: number, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    const item = items.value.find((i) => i.id === id)
    if (file && item) await setItemPicture(item, file, false)
  }
  function clearItemPicture(id: number) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    if (item.coverUrl) URL.revokeObjectURL(item.coverUrl)
    Object.assign(item, { coverKey: null, coverUrl: null, coverFromFile: false })
  }
  async function onPickLogo(file: File) {
    const problem = coverFileProblem(file)
    if (problem) {
      toast.add({ title: 'Can’t use that logo', description: problem, color: 'warning' })
      return
    }
    logoUploading.value = true
    logoProgress.value = 0
    try {
      const ticket = await videos.requestUpload('OVERLAY', file)
      await uploadToStorage(ticket, file, (f) => (logoProgress.value = f))
      if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
      logoKey.value = ticket.key
      logoUrl.value = URL.createObjectURL(file)
    } catch (err) {
      toast.add({ title: 'Could not upload the logo', description: apiErrorMessage(err), color: 'error' })
    } finally {
      logoUploading.value = false
    }
  }
  function clearLogo() {
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
    logoKey.value = null
    logoUrl.value = null
  }

  // ── Music under the recordings ───────────────────────────────────────────────
  async function onPickMusic(file: File) {
    const problem = audioFileProblem(file, maxUploadMb.value)
    if (problem) {
      toast.add({ title: 'Can’t use that music', description: problem, color: 'warning' })
      return
    }
    musicUploading.value = true
    musicProgress.value = 0
    try {
      const { key } = await videos.uploadFile('AUDIO', file, { onProgress: (f) => (musicProgress.value = f) })
      music.value = { key, name: file.name }
    } catch (err) {
      toast.add({ title: 'Could not upload the music', description: apiErrorMessage(err), color: 'error' })
    } finally {
      musicUploading.value = false
    }
  }

  // ── Colours from the cover ───────────────────────────────────────────────────
  /** The picture to take colours from: the previewed recording's own, else the one showing. */
  const paletteSource = computed(() => previewOwnCover.value ?? shownSlide.value?.previewUrl ?? null)
  async function useCoverColours() {
    const url = paletteSource.value
    if (!url) return
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      // A small copy is plenty to find the main colours.
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = Math.max(1, Math.round((64 * img.naturalHeight) / Math.max(1, img.naturalWidth)))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const { background: bg, accent } = paletteFromPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
      setBackground(bg)
      waveAuto.value = false
      waveColor.value = accent
      toast.add({ title: 'Colours taken from the picture', description: 'Undo by picking other colours.', color: 'success' })
    } catch {
      toast.add({ title: 'Could not read the picture’s colours', color: 'warning' })
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function onSubmit() {
    errors.value = {}
    saveError.value = ''
    if (!readyItems.value.length) {
      errors.value.audio = 'Choose the audio first'
      return
    }
    if (requireCategory.value && !categoryIds.value.length) errors.value.categoryIds = 'Choose at least one category'
    if (categoryIds.value.length > maxCategories.value) errors.value.categoryIds = `At most ${maxCategories.value}`
    if (transcribe.value && !language.value) errors.value.language = 'Choose the spoken language to transcribe'
    if (Object.keys(errors.value).length) return

    saving.value = true
    const chosen = readyItems.value
    const titles = uniqueTitles(chosen.map((i) => i.title.trim()))
    const made: { id: number; jobId: number; title: string }[] = []
    /** Highlight clips: made too, but kept out of the collection and the schedule (they're for elsewhere). */
    const highlights: { id: number; jobId: number; title: string }[] = []
    const failed: string[] = []
    try {
      // One at a time and in order, so a collection ends up in the order the files were added.
      const shared = slides.value.map((sl) => ({ key: sl.key, startMs: sl.startMs }))
      const extras = {
        blurBackdrop: blurBackdrop.value || undefined,
        progressBar: progressBar.value || undefined,
        music: music.value ? { key: music.value.key, volume: musicVolume.value, loop: true, duck: musicDuck.value } : undefined
      }
      const burn = () =>
        transcribe.value && burnSubtitles.value
          ? { style: subtitleStyle.value, position: subtitlePosition.value, secondLanguage: secondLanguage.value }
          : undefined
      for (let i = 0; i < chosen.length; i++) {
        const item = chosen[i]!
        // A long recording becomes several videos, cut at its pauses (found on the server).
        let parts: { startMs: number; endMs: number }[] | null = null
        if (chapters.value && (item.durationSeconds ?? 0) > partMinutes.value * 90) {
          try {
            const found = (await videos.chaptersFromAudio(item.key, partMinutes.value)).parts
            if (found.length > 1) parts = found
          } catch (err) {
            failed.push(`${titles[i]}: couldn't find where to split it (${apiErrorMessage(err)}) — made as one video`)
          }
        }
        for (const [k, part] of (parts ?? [null]).entries()) {
          const title = parts ? partTitle(titles[i]!, k, parts.length) : titles[i]!
          const seconds = part ? Math.round((part.endMs - part.startMs) / 1000) : item.durationSeconds
          const pictures = recordingSlides(shared, item.coverKey, seconds, spreadPerRecording.value)
          const partChapters = useChapters.value ? chaptersForPart(item.chapters, part) : []
          try {
            const result = await videos.createFromAudio({
              audioKey: item.key,
              coverKey: pictures.length === 1 ? pictures[0]!.key : undefined,
              slides: pictures.length > 1 ? pictures : undefined,
              background: background.value,
              resolution: resolution.value,
              waveform: waveform.value,
              waveColor: waveform.value !== 'NONE' && !waveAuto.value ? waveColor.value : undefined,
              waveHeightPct: waveform.value !== 'NONE' && waveHeight.value != null ? waveHeight.value : undefined,
              titleCard: titleCard.value && !pictures.length ? true : undefined,
              normalize: normalize.value || undefined,
              denoise: denoise.value || undefined,
              transcribe: transcribe.value || undefined,
              shape: shape.value !== 'WIDE' ? shape.value : undefined,
              motion: motion.value && pictures.length ? true : undefined,
              crossfade: crossfade.value && pictures.length > 1 ? true : undefined,
              stripText: stripText.value.trim() || undefined,
              logoKey: logoKey.value ?? undefined,
              trimSilence: trimSilence.value || undefined,
              audioStartMs: part?.startMs,
              audioEndMs: part?.endMs,
              burnSubtitles: burn(),
              ...extras,
              chapters: partChapters.length ? partChapters : undefined,
              intro: cardRequest(intro),
              outro: cardRequest(outro),
              title,
              description: description.value.trim() || undefined,
              language: language.value,
              categoryIds: categoryIds.value
            })
            made.push({ id: result.video.id, jobId: result.job.id, title })
          } catch (err) {
            failed.push(`${title}: ${apiErrorMessage(err)}`)
            if (chosen.length === 1 && !parts && !highlight.value) throw err
          }
        }
        // A short tall video of the liveliest stretch, for Shorts / Reels / TikTok: same look, no cards or chapters.
        if (highlight.value) {
          const title = highlightTitle(titles[i]!)
          try {
            const range = await videos.highlightFromAudio(item.key, highlightSeconds.value)
            const pictures = recordingSlides(shared, item.coverKey, Math.round((range.endMs - range.startMs) / 1000), true)
            const result = await videos.createFromAudio({
              audioKey: item.key,
              coverKey: pictures.length === 1 ? pictures[0]!.key : undefined,
              slides: pictures.length > 1 ? pictures : undefined,
              background: background.value,
              resolution: resolution.value,
              waveform: waveform.value,
              waveColor: waveform.value !== 'NONE' && !waveAuto.value ? waveColor.value : undefined,
              waveHeightPct: waveform.value !== 'NONE' && waveHeight.value != null ? waveHeight.value : undefined,
              titleCard: titleCard.value && !pictures.length ? true : undefined,
              normalize: normalize.value || undefined,
              denoise: denoise.value || undefined,
              transcribe: transcribe.value || undefined,
              shape: 'TALL',
              motion: motion.value && pictures.length ? true : undefined,
              crossfade: crossfade.value && pictures.length > 1 ? true : undefined,
              stripText: stripText.value.trim() || undefined,
              logoKey: logoKey.value ?? undefined,
              audioStartMs: range.startMs,
              audioEndMs: range.endMs,
              burnSubtitles: burn(),
              ...extras,
              title,
              description: description.value.trim() || undefined,
              language: language.value,
              categoryIds: categoryIds.value
            })
            highlights.push({ id: result.video.id, jobId: result.job.id, title })
          } catch (err) {
            failed.push(`${title}: ${apiErrorMessage(err)}`)
          }
        }
      }

      if (collectionId.value && made.length) {
        try {
          await collections.addVideos(
            collectionId.value,
            made.map((m) => m.id)
          )
        } catch (err) {
          toast.add({ title: 'Made the videos, but could not add them to the collection', description: apiErrorMessage(err), color: 'warning' })
        }
      }
      // Each enables itself in turn once made (the server waits for a video's job to finish first).
      const start = schedule.value ? fromDateTimeLocal(scheduleStart.value) : null
      if (start && made.length) {
        const plan = scheduleSeries(
          made.map((m) => ({ ...m, enabled: false })),
          start,
          scheduleStep.value,
          new Date()
        )
        const skipped = plan.filter((p) => !p.at).length
        for (const p of plan) {
          if (!p.at) continue
          try {
            await videos.schedulePublish(p.video.id, p.at)
          } catch (err) {
            failed.push(`${p.video.title}: not scheduled (${apiErrorMessage(err)})`)
          }
        }
        if (skipped) failed.push(`${skipped} video(s) not scheduled — ${plan.find((p) => !p.at)?.skipped}`)
      }
    } catch (err) {
      saveError.value = apiErrorMessage(err)
      saving.value = false
      return
    }
    saving.value = false

    made.push(...highlights)
    if (!made.length) {
      saveError.value = failed.join(' · ')
      return
    }
    submitted.value = true
    if (failed.length) {
      toast.add({ title: `${made.length} of ${chosen.length} videos are being made`, description: failed.join(' · '), color: 'warning' })
    } else {
      toast.add({
        title: made.length === 1 ? 'Making the video' : `Making ${made.length} videos`,
        description: 'You can leave; it keeps going in the background.',
        color: 'success'
      })
    }
    // One video: go to it (it shows the progress). Several: a page following them all.
    await navigateTo(made.length === 1 ? `/videos/${made[0]!.id}` : { path: '/videos/made', query: { jobs: made.map((m) => m.jobId).join(',') } })
  }

  return {
    currentSeriesLook,
    applySeriesLook,
    videos,
    collections,
    toast,
    clientSettings,
    maxUploadMb,
    maxCategories,
    requireCategory,
    items,
    slides,
    picUploading,
    picProgress,
    previewSeconds,
    background,
    backgroundText,
    resolution,
    waveform,
    waveAuto,
    waveColor,
    titleCard,
    normalize,
    denoise,
    description,
    language,
    categoryIds,
    collectionId,
    transcribe,
    shape,
    motion,
    crossfade,
    spreadPerRecording,
    stripText,
    logoKey,
    logoUrl,
    logoUploading,
    logoProgress,
    trimSilence,
    waveHeight,
    waveHeightShown,
    setWaveHeight,
    chapters,
    partMinutes,
    burnSubtitles,
    subtitleStyle,
    subtitlePosition,
    secondLanguage,
    blurBackdrop,
    progressBar,
    useChapters,
    chapterCount,
    intro,
    outro,
    cardsError,
    music,
    musicUploading,
    musicProgress,
    musicVolume,
    musicDuck,
    onPickMusic,
    highlight,
    highlightSeconds,
    schedule,
    scheduleStart,
    scheduleStep,
    paletteSource,
    useCoverColours,
    errors,
    saveError,
    saving,
    submitted,
    dragging,
    languageItems,
    categoryItems,
    collectionItems,
    collectionsLoading,
    stripOnTop,
    subtitleClash,
    partsOf,
    longItems,
    videoCount,
    videoCountLabel,
    commitPartMinutes,
    previewOwnCover,
    previewItemId,
    previewItem,
    blockerStep,
    scrollToStep,
    readyItems,
    slideStarts,
    slideError,
    shortestSeconds,
    beyond,
    spreadStarts,
    previewMax,
    shownIndex,
    shownSlide,
    uploadingAny,
    blocker,
    canSubmit,
    submitLabel,
    selectedSize,
    readySummary,
    loadPrefs,
    appValue,
    setApp,
    LOOK_KEY,
    totalLength,
    renderNote,
    darkBackground,
    textColor,
    currentWaveLook,
    applyWaveLook,
    TEST_RENDER_SECONDS,
    audioPeaks,
    previewFile,
    firstFile,
    previewFromAudio,
    previewNote,
    testAudioKey,
    testRendering,
    testRender,
    testSignature,
    testRenderStale,
    onTestRender,
    customOpen,
    offeredStyles,
    waveDrawColor,
    previewTitle,
    setBackground,
    commitBackgroundText,
    readDuration,
    addFiles,
    onPickFiles,
    onDragEnter,
    onDragLeave,
    onDrop,
    pump,
    retryItem,
    removeItem,
    moveItem,
    playingId,
    stopPlaying,
    togglePlay,
    onPickPictures,
    typeStart,
    movePicture,
    removeSlide,
    spread,
    setItemPicture,
    onPickItemPicture,
    clearItemPicture,
    onPickLogo,
    clearLogo,
    onSubmit
  }
}

const FORM_KEY: InjectionKey<ReturnType<typeof useAudioToVideoForm>> = Symbol('audio-to-video-form')

/** Makes the form and hands it to the step components below the page. */
export function provideAudioToVideoForm() {
  const form = useAudioToVideoForm()
  provide(FORM_KEY, form)
  return form
}

/** The page's form, in one of its step components. */
export function useAudioToVideoFormContext() {
  const form = inject(FORM_KEY)
  if (!form) throw new Error('A Video from audio step must sit inside the from-audio page')
  return form
}
