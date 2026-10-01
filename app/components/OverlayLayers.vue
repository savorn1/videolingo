<template>
  <div ref="root" class="absolute inset-0 z-10 pointer-events-none select-none" data-testid="overlay-layers">
    <!-- Alignment guides while dragging near the frame's centre, or another layer's edge/centre -->
    <template v-if="picture && dragging">
      <div
        v-if="guide.x != null"
        class="absolute w-px bg-primary-400/80"
        :style="{ left: `${picture.left + guide.x * picture.w}px`, top: `${picture.top}px`, height: `${picture.h}px` }"
      />
      <div
        v-if="guide.y != null"
        class="absolute h-px bg-primary-400/80"
        :style="{ top: `${picture.top + guide.y * picture.h}px`, left: `${picture.left}px`, width: `${picture.w}px` }"
      />
    </template>

    <template v-if="picture">
      <div
        v-for="l in shown"
        :key="l.id"
        data-testid="overlay-layer"
        :data-layer-id="l.id"
        class="absolute"
        :class="
          readonly
            ? ''
            : l.id === edit.state.selectedId
            ? 'pointer-events-auto cursor-move outline-2 outline-dashed outline-primary-400 outline-offset-2'
            : 'pointer-events-auto cursor-move hover:outline hover:outline-white/60 outline-offset-2'
        "
        :style="layerStyle(l)"
        @pointerdown="onPointerDown(l, $event)"
        @dblclick.stop="l.kind === 'TEXT' && startEdit(l)"
        @click.stop
      >
        <div
          v-if="l.kind === 'TEXT'"
          :data-editing="editingId === l.id || undefined"
          :contenteditable="editingId === l.id ? 'plaintext-only' : undefined"
          :class="editingId === l.id && 'select-text outline-none'"
          :style="textStyle(l)"
          @blur="editingId === l.id && endEdit(l, $event)"
          @keydown.esc.stop.prevent="editingId === l.id && endEdit(l, $event)"
          @keydown.enter.ctrl.stop.prevent="editingId === l.id && endEdit(l, $event)"
          @keydown.stop="editingId === l.id"
          >{{ l.text }}</div
        >
        <img v-else-if="l.imageUrl" :src="l.imageUrl" alt="" draggable="false" class="block w-full h-auto" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// The editor's text & image layers drawn over the preview, where the server
// will put them: positioned on the picture (not the letterbox bars), sized
// relative to it, with opacity and the fade/slide worked out for the
// current time. Drag a layer to move it; it snaps to the centre lines.
import { animationSeconds, fontCss, type EditorLayer, type OverlayEdit } from '~/composables/useOverlayEdit'
import { snapAxis } from '#shared/utils/layerSnap'

const props = defineProps<{ edit: OverlayEdit; naturalWidth: number; naturalHeight: number; currentMs: number; zoom?: number; durationMs: number; readonly?: boolean }>()

const root = useTemplateRef<HTMLDivElement>('root')
const size = ref({ w: 0, h: 0 })
let observer: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  size.value = { w: root.value.offsetWidth, h: root.value.offsetHeight }
  observer = new ResizeObserver(([e]) => e && (size.value = { w: e.contentRect.width, h: e.contentRect.height }))
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

// The picture inside the letterboxed player (object-fit: contain).
const picture = computed(() => {
  const { w, h } = size.value
  const nw = props.naturalWidth || 16
  const nh = props.naturalHeight || 9
  if (!w || !h) return null
  const scale = Math.min(w / nw, h / nh)
  const pw = nw * scale
  const ph = nh * scale
  return { left: (w - pw) / 2, top: (h - ph) / 2, w: pw, h: ph }
})

function endOf(l: EditorLayer) {
  return l.endMs ?? props.durationMs
}

// Layers on screen at the current time; the selected one always (so it can be edited), faded when it's off-screen then.
const shown = computed(() =>
  props.edit.state.layers.filter((l) => (!props.readonly && l.id === props.edit.state.selectedId) || (props.currentMs >= l.startMs && props.currentMs < endOf(l)))
)

// 0–1 through the entrance (and 1–0 through the exit), as the backend's fades and slides.
function entrance(l: EditorLayer) {
  if (l.animation === 'NONE') return { alpha: 1, t: 1 }
  const d = animationSeconds(l.startMs, endOf(l)) * 1000
  if (d <= 0) return { alpha: 1, t: 1 }
  const tIn = Math.min(1, Math.max(0, (props.currentMs - l.startMs) / d))
  const tOut = Math.min(1, Math.max(0, (endOf(l) - props.currentMs) / d))
  return { alpha: Math.min(tIn, tOut), t: tIn }
}

function layerStyle(l: EditorLayer) {
  const p = picture.value!
  const active = props.currentMs >= l.startMs && props.currentMs < endOf(l)
  const { alpha, t } = active ? entrance(l) : { alpha: 1, t: 1 }
  const dy = active && l.animation === 'SLIDE_UP' ? p.h * 0.06 * (1 - t) : 0
  const style: Record<string, string> = {
    left: `${p.left + l.x * p.w}px`,
    top: `${p.top + l.y * p.h}px`,
    transform: `translate(-50%, -50%) translateY(${dy}px)`,
    opacity: String(active ? l.opacity * alpha : 0.35)
  }
  if (active && l.animation === 'SLIDE_LEFT' && t < 1) {
    // Starts with its right edge at the picture's left edge, like the render.
    const back = 1 - t
    style.transform = `translate(calc(-50% - ${l.x * p.w * back}px - ${50 * back}%), -50%)`
  }
  if (l.kind === 'IMAGE') style.width = `${(l.widthPct / 100) * p.w}px`
  return style
}

function textStyle(l: EditorLayer) {
  const p = picture.value!
  const px = (l.sizePct / 100) * p.h
  const box = !!l.background && l.backgroundOpacity > 0
  const bg = box ? hexToRgba(l.background!, l.backgroundOpacity) : 'transparent'
  return {
    fontFamily: fontCss(l.font),
    fontWeight: String(l.weight),
    fontSize: `${px}px`,
    lineHeight: '1.2',
    color: l.color ?? '#ffffff',
    background: bg,
    padding: box ? `${px * 0.25}px ${px * 0.45}px` : `${px * 0.1}px`,
    borderRadius: `${px * 0.25}px`,
    whiteSpace: 'pre',
    textAlign: (l.align ?? 'CENTER').toLowerCase() as 'left' | 'center' | 'right'
  }
}

function hexToRgba(hex: string, a: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// ── Dragging: snaps to the frame's centre, and to other layers' edges/centre ──
const dragging = ref(false)
const guide = reactive<{ x: number | null; y: number | null }>({ x: null, y: null })
// A layer's box for snapping: centre from its own authored x/y (not the
// live DOM position, which a mid-entrance animation can offset far from
// where the layer actually sits), half-width/-height from the DOM (its
// rendered size, which opacity/position animations don't change — reading
// it means not re-deriving text wrapping or image aspect ratio by hand).
function frameBox(el: Element, cx: number, cy: number, p: { w: number; h: number }, k: number) {
  const r = (el as HTMLElement).getBoundingClientRect()
  return { cx, cy, halfW: r.width / k / 2 / p.w, halfH: r.height / k / 2 / p.h }
}

// ── Double-click a text layer to type on the video ───────────────────────────
// The text is committed on blur, Esc or Ctrl/⌘+Enter (a plain Enter is a line break).
const editingId = ref<string | null>(null)
async function startEdit(l: EditorLayer) {
  if (props.readonly) return
  props.edit.select(l.id)
  editingId.value = l.id
  await nextTick()
  const el = root.value?.querySelector<HTMLElement>('[data-editing]')
  if (!el) return
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
function endEdit(l: EditorLayer, e: Event) {
  const el = e.target as HTMLElement
  editingId.value = null
  const text = (el.innerText ?? '').replace(/\n$/, '')
  if (text.trim()) l.text = text
  else el.innerText = l.text ?? ''
}
function onPointerDown(l: EditorLayer, e: PointerEvent) {
  if (props.readonly) return
  e.stopPropagation()
  if (editingId.value === l.id) return // let the caret move; no drag while typing
  e.preventDefault()
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    props.edit.toggleMulti(l.id)
    return
  }
  // Grabbing a layer of the group drags the whole group; grabbing another one picks just that.
  if (!props.edit.isPicked(l.id)) props.edit.select(l.id)
  onDown(l, e)
}

function onDown(l: EditorLayer, e: PointerEvent) {
  if (e.button !== 0) return
  const rect = root.value!.getBoundingClientRect()
  // Screen px per layout px (the zoom around the preview), then per picture fraction.
  const k = rect.width / Math.max(size.value.w, 1)
  const p = picture.value!
  const el = e.currentTarget as HTMLElement
  const self = frameBox(el, l.x, l.y, p, k)
  const byId = new Map(props.edit.state.layers.map((x) => [x.id, x]))
  const others = [...root.value!.querySelectorAll<HTMLElement>('[data-layer-id]')]
    .filter((o) => o.dataset.layerId !== l.id)
    .map((o) => {
      const other = byId.get(o.dataset.layerId!)
      return other ? frameBox(o, other.x, other.y, p, k) : null
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
  const xCenters = [0.5, ...others.map((o) => o.cx)]
  const xEdges = others.flatMap((o) => [o.cx - o.halfW, o.cx + o.halfW])
  const yCenters = [0.5, ...others.map((o) => o.cy)]
  const yEdges = others.flatMap((o) => [o.cy - o.halfH, o.cy + o.halfH])

  const start = { cx: e.clientX, cy: e.clientY, x: l.x, y: l.y }
  const mates = props.edit.group.value.filter((m) => m.id !== l.id).map((m) => ({ m, x: m.x, y: m.y }))
  dragging.value = true
  const move = (ev: PointerEvent) => {
    const rawX = start.x + (ev.clientX - start.cx) / k / p.w
    const rawY = start.y + (ev.clientY - start.cy) / k / p.h
    const sx = snapAxis(rawX, self.halfW, xCenters, xEdges)
    const sy = snapAxis(rawY, self.halfH, yCenters, yEdges)
    guide.x = sx.guide
    guide.y = sy.guide
    l.x = Math.round(Math.min(1, Math.max(0, sx.value)) * 1000) / 1000
    l.y = Math.round(Math.min(1, Math.max(0, sy.value)) * 1000) / 1000
    for (const g of mates) {
      g.m.x = clamp01(g.x + (l.x - start.x))
      g.m.y = clamp01(g.y + (l.y - start.y))
    }
  }
  const up = () => {
    dragging.value = false
    guide.x = guide.y = null
    window.removeEventListener('pointermove', move)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
}

// ── Keyboard: nudge or delete the selected layer ────────────────────────────
// Dragging is imprecise for a one-pixel adjustment; arrow keys fill that gap,
// the same way most design tools let you nudge a selected object. Delete/
// Backspace removes it outright — EditorTransport yields its own arrow-key
// frame-stepping while a layer is selected here (see arrowKeysTaken).
function isEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}
const NUDGE = 0.005
const NUDGE_BIG = 0.02
function clamp01(v: number) {
  return Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000
}
function onKeyDown(e: KeyboardEvent) {
  const l = props.edit.selected.value
  if (!l || isEditable(e.target)) return
  const step = e.shiftKey ? NUDGE_BIG : NUDGE
  const all = props.edit.group.value
  switch (e.key) {
    case 'ArrowLeft':
      for (const g of all) g.x = clamp01(g.x - step)
      break
    case 'ArrowRight':
      for (const g of all) g.x = clamp01(g.x + step)
      break
    case 'ArrowUp':
      for (const g of all) g.y = clamp01(g.y - step)
      break
    case 'ArrowDown':
      for (const g of all) g.y = clamp01(g.y + step)
      break
    case 'Delete':
    case 'Backspace':
      props.edit.removeGroup()
      break
    default:
      return
  }
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>
