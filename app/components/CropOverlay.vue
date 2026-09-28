<template>
  <div ref="root" class="absolute inset-0 pointer-events-none">
    <div
      class="absolute border-2 border-primary-500 bg-primary-500/10 pointer-events-auto cursor-move touch-none"
      :style="boxStyle"
      @pointerdown="startDrag"
    >
      <div
        v-for="corner in CORNERS"
        :key="corner"
        class="absolute w-3 h-3 bg-primary-500 rounded-full pointer-events-auto touch-none"
        :class="cornerClass[corner]"
        @pointerdown.stop="startResize(corner, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// A draggable/resizable crop rectangle over a video, rendered through
// VideoPlayer's `overlay` slot. Works in native video-pixel coordinates
// (0..naturalWidth/Height); the video fills its box exactly (w-full h-full,
// no object-fit), so mapping to/from the displayed box is a plain linear
// scale — no letterboxing to account for.
const props = defineProps<{ naturalWidth: number; naturalHeight: number }>()
const model = defineModel<{ x: number; y: number; w: number; h: number }>({ required: true })

const root = ref<HTMLElement | null>(null)

function scaleFactors() {
  const rect = root.value?.getBoundingClientRect()
  if (!rect || !props.naturalWidth || !props.naturalHeight) return null
  return { sx: rect.width / props.naturalWidth, sy: rect.height / props.naturalHeight, rect }
}

const boxStyle = computed(() => {
  const f = scaleFactors()
  if (!f) return {}
  return {
    left: `${model.value.x * f.sx}px`,
    top: `${model.value.y * f.sy}px`,
    width: `${model.value.w * f.sx}px`,
    height: `${model.value.h * f.sy}px`
  }
})

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const
type Corner = (typeof CORNERS)[number]
const cornerClass: Record<Corner, string> = {
  nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
  ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
  sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
  se: '-bottom-1.5 -right-1.5 cursor-nwse-resize'
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

let dragStart: { x: number; y: number; orig: { x: number; y: number; w: number; h: number } } | null = null
function startDrag(e: PointerEvent) {
  dragStart = { x: e.clientX, y: e.clientY, orig: { ...model.value } }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}
function onDragMove(e: PointerEvent) {
  const f = scaleFactors()
  if (!dragStart || !f) return
  const dx = (e.clientX - dragStart.x) / f.sx
  const dy = (e.clientY - dragStart.y) / f.sy
  const x = clamp(Math.round(dragStart.orig.x + dx), 0, props.naturalWidth - dragStart.orig.w)
  const y = clamp(Math.round(dragStart.orig.y + dy), 0, props.naturalHeight - dragStart.orig.h)
  model.value = { ...model.value, x, y }
}
function onDragEnd() {
  dragStart = null
  window.removeEventListener('pointermove', onDragMove)
}

const MIN_SIZE = 20
let resizeStart: { corner: Corner; x: number; y: number; orig: { x: number; y: number; w: number; h: number } } | null = null
function startResize(corner: Corner, e: PointerEvent) {
  resizeStart = { corner, x: e.clientX, y: e.clientY, orig: { ...model.value } }
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
}
function onResizeMove(e: PointerEvent) {
  const f = scaleFactors()
  if (!resizeStart || !f) return
  const dx = (e.clientX - resizeStart.x) / f.sx
  const dy = (e.clientY - resizeStart.y) / f.sy
  const o = resizeStart.orig
  let { x, y, w, h } = o
  if (resizeStart.corner.includes('w')) {
    x = o.x + dx
    w = o.w - dx
  }
  if (resizeStart.corner.includes('e')) {
    w = o.w + dx
  }
  if (resizeStart.corner.includes('n')) {
    y = o.y + dy
    h = o.h - dy
  }
  if (resizeStart.corner.includes('s')) {
    h = o.h + dy
  }
  w = Math.max(MIN_SIZE, w)
  h = Math.max(MIN_SIZE, h)
  x = clamp(x, 0, props.naturalWidth - w)
  y = clamp(y, 0, props.naturalHeight - h)
  w = Math.min(w, props.naturalWidth - x)
  h = Math.min(h, props.naturalHeight - y)
  model.value = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}
function onResizeEnd() {
  resizeStart = null
  window.removeEventListener('pointermove', onResizeMove)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointermove', onResizeMove)
})
</script>
