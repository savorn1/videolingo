<template>
  <div ref="root" class="absolute inset-0 z-10 cursor-crosshair touch-none select-none" @pointerdown="startDraw">
    <!-- The huge shadow dims everything outside the crop, so the kept area stands out. -->
    <div
      v-if="hasBox"
      class="absolute border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move"
      :style="{ ...boxStyle, borderWidth: `${2 / zoomLevel}px` }"
      @pointerdown.stop="startMove"
    >
      <!-- Rule-of-thirds guides -->
      <div class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
        <div v-for="n in 9" :key="n" class="border-white/20" :style="{ borderWidth: `${0.5 / zoomLevel}px` }" />
      </div>
      <!-- Label and handles are counter-scaled so they stay the same size on screen at any zoom. -->
      <span
        class="absolute left-0 bottom-full mb-1 origin-bottom-left rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums whitespace-nowrap"
        :style="{ scale: `${1 / zoomLevel}` }"
      >
        {{ model.w }} × {{ model.h }}
      </span>
      <div
        v-for="h in HANDLES"
        :key="h.id"
        class="absolute w-3.5 h-3.5 bg-white border border-gray-900/40 rounded-sm"
        :class="h.cls"
        :style="{ scale: `${1 / zoomLevel}` }"
        @pointerdown.stop="startResize(h.id, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Crop selection over a video, rendered through VideoPlayer's `overlay`
// slot: press and drag anywhere to draw the area to keep, drag inside it to
// move it, drag a handle to resize. Works in native video pixels
// (0..naturalWidth/Height), mapped onto the letterboxed picture area.
// `zoom`: how much the preview around this overlay is scaled (CSS transform),
// so handles can stay a constant size on screen.
const props = defineProps<{ naturalWidth: number; naturalHeight: number; aspect?: number | null; zoom?: number }>()
const zoomLevel = computed(() => props.zoom || 1)
const model = defineModel<{ x: number; y: number; w: number; h: number }>({ required: true })

const root = ref<HTMLElement | null>(null)
const MIN_SIZE = 16

const hasBox = computed(() => model.value.w > 0 && model.value.h > 0 && props.naturalWidth > 0)

// Where the picture actually is inside the player: <video> letterboxes
// (object-fit: contain), so a 4:3 video in the 16:9 player has bars at the
// sides. Everything maps through this rect, not the whole player box.
const size = ref({ w: 0, h: 0 })
let observer: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  // Measured now too: the observer reports a frame later, and a drag can be
  // handed to us (beginDraw) the moment we mount. offset* is the layout size,
  // unaffected by the zoom transform — the same as contentRect.
  size.value = { w: root.value.offsetWidth, h: root.value.offsetHeight }
  observer = new ResizeObserver(([entry]) => {
    if (entry) size.value = { w: entry.contentRect.width, h: entry.contentRect.height }
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const picture = computed(() => {
  const { w, h } = size.value
  if (!w || !h || !props.naturalWidth || !props.naturalHeight) return null
  const scale = Math.min(w / props.naturalWidth, h / props.naturalHeight)
  const pw = props.naturalWidth * scale
  const ph = props.naturalHeight * scale
  return { left: (w - pw) / 2, top: (h - ph) / 2, scale }
})

function box() {
  const rect = root.value?.getBoundingClientRect()
  const p = picture.value
  if (!rect || !p) return null
  return { rect, p }
}

// Screen point → video pixel, clamped to the frame. The on-screen rect is
// scaled by any zoom around us while `size` is the unscaled layout size, so
// their ratio undoes the zoom.
function toVideo(e: { clientX: number; clientY: number }) {
  const { rect, p } = box()!
  const k = rect.width / size.value.w
  return {
    x: clamp(((e.clientX - rect.left) / k - p.left) / p.scale, 0, props.naturalWidth),
    y: clamp(((e.clientY - rect.top) / k - p.top) / p.scale, 0, props.naturalHeight)
  }
}

const boxStyle = computed(() => {
  const p = picture.value
  if (!p) return {}
  const m = model.value
  return {
    left: `${p.left + m.x * p.scale}px`,
    top: `${p.top + m.y * p.scale}px`,
    width: `${m.w * p.scale}px`,
    height: `${m.h * p.scale}px`
  }
})
type HandleId = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
const HANDLES: { id: HandleId; cls: string }[] = [
  { id: 'nw', cls: '-top-2 -left-2 cursor-nwse-resize' },
  { id: 'ne', cls: '-top-2 -right-2 cursor-nesw-resize' },
  { id: 'sw', cls: '-bottom-2 -left-2 cursor-nesw-resize' },
  { id: 'se', cls: '-bottom-2 -right-2 cursor-nwse-resize' },
  { id: 'n', cls: '-top-2 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { id: 's', cls: '-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { id: 'w', cls: 'top-1/2 -left-2 -translate-y-1/2 cursor-ew-resize' },
  { id: 'e', cls: 'top-1/2 -right-2 -translate-y-1/2 cursor-ew-resize' }
]

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function emitRect(x: number, y: number, w: number, h: number) {
  model.value = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

// ── Interactions (one active at a time; window listeners so a drag can leave the video) ──
let onMove: ((e: PointerEvent) => void) | null = null
function track(move: (e: PointerEvent) => void) {
  // The button can already be up when a drag is handed over (beginDraw), so a
  // move with no button pressed ends it instead of drawing forever.
  onMove = (e) => (e.buttons & 1 ? move(e) : stop())
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', stop, { once: true })
}
function stop() {
  if (onMove) window.removeEventListener('pointermove', onMove)
  onMove = null
}
onBeforeUnmount(stop)

// Draw a new rectangle from wherever the press started.
function startDraw(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  beginDraw(e)
}

// Also called by the parent to continue a drag that began before this layer
// existed: `from` is where the press started, `to` where the pointer is now.
function beginDraw(from: { clientX: number; clientY: number }, to?: PointerEvent) {
  if (!box()) return
  const a = toVideo(from)
  const draw = (ev: PointerEvent) => {
    const b = toVideo(ev)
    let w = Math.abs(b.x - a.x)
    let h = Math.abs(b.y - a.y)
    if (props.aspect) {
      // Keep the chosen shape: the dominant drag direction wins.
      if (w / h > props.aspect) w = h * props.aspect
      else h = w / props.aspect
    }
    const x = b.x < a.x ? a.x - w : a.x
    const y = b.y < a.y ? a.y - h : a.y
    const cx = clamp(x, 0, props.naturalWidth - w)
    const cy = clamp(y, 0, props.naturalHeight - h)
    if (w >= MIN_SIZE && h >= MIN_SIZE) emitRect(cx, cy, w, h)
  }
  if (to) draw(to)
  track(draw)
}
defineExpose({ beginDraw })

function startMove(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  const start = toVideo(e)
  const o = { ...model.value }
  track((ev) => {
    const p = toVideo(ev)
    emitRect(clamp(o.x + p.x - start.x, 0, props.naturalWidth - o.w), clamp(o.y + p.y - start.y, 0, props.naturalHeight - o.h), o.w, o.h)
  })
}

function startResize(handle: HandleId, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  const o = { ...model.value }
  const right = o.x + o.w
  const bottom = o.y + o.h
  track((ev) => {
    const p = toVideo(ev)
    let x1 = o.x,
      y1 = o.y,
      x2 = right,
      y2 = bottom
    if (handle.includes('w')) x1 = Math.min(p.x, right - MIN_SIZE)
    if (handle.includes('e')) x2 = Math.max(p.x, o.x + MIN_SIZE)
    if (handle.includes('n')) y1 = Math.min(p.y, bottom - MIN_SIZE)
    if (handle.includes('s')) y2 = Math.max(p.y, o.y + MIN_SIZE)
    let w = x2 - x1
    let h = y2 - y1
    if (props.aspect) {
      // Edge handles drive one dimension; corners follow whichever moved more.
      if (handle === 'n' || handle === 's' || (handle.length === 2 && h * props.aspect > w)) w = h * props.aspect
      else h = w / props.aspect
      if (handle.includes('w')) x1 = right - w
      if (handle.includes('n')) y1 = bottom - h
    }
    if (x1 < 0 || y1 < 0 || x1 + w > props.naturalWidth || y1 + h > props.naturalHeight) return
    emitRect(x1, y1, w, h)
  })
}
</script>
