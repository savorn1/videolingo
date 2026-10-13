<template>
  <div ref="root" class="absolute inset-0 z-10" data-testid="look-compare">
    <!-- The frame without the look, shown left of the divider -->
    <canvas ref="canvas" class="pointer-events-none absolute inset-0 h-full w-full" :style="{ clipPath: `inset(0 ${(1 - at) * 100}% 0 0)` }" />
    <span class="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Before</span>
    <span class="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">After</span>
    <div class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow" :style="{ left: `${at * 100}%` }">
      <button
        type="button"
        role="slider"
        aria-label="Before and after divider"
        :aria-valuenow="Math.round(at * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        class="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-gray-800 shadow focus-visible:outline-2 focus-visible:outline-primary-500"
        @pointerdown.stop.prevent="onDown"
        @keydown.left.stop.prevent="at = Math.max(0.02, at - 0.05)"
        @keydown.right.stop.prevent="at = Math.min(0.98, at + 0.05)"
      >
        <UIcon name="i-lucide-chevrons-left-right" class="size-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Before / after on the preview while a look is set: the current frame drawn without the look onto a canvas, shown
// left of a draggable divider; right of it, the preview itself with the look (its CSS filter).
import { containRect, dividerAt } from '#shared/utils/lookCompare'

const props = defineProps<{ videoEl: HTMLVideoElement | null | undefined }>()

const root = useTemplateRef<HTMLDivElement>('root')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const at = ref(0.5)

let frame = 0
function draw() {
  frame = requestAnimationFrame(draw)
  const v = props.videoEl
  const c = canvas.value
  const box = root.value
  if (!v || !c || !box || !v.videoWidth) return
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(box.clientWidth * dpr)
  const h = Math.round(box.clientHeight * dpr)
  if (c.width !== w || c.height !== h) Object.assign(c, { width: w, height: h })
  const ctx = c.getContext('2d')
  if (!ctx) return
  const r = containRect(w, h, v.videoWidth, v.videoHeight)
  ctx.clearRect(0, 0, w, h)
  try {
    ctx.drawImage(v, r.x, r.y, r.w, r.h)
  } catch {
    // A frame that can't be read yet (still loading): try again next frame.
  }
}
onMounted(() => (frame = requestAnimationFrame(draw)))
onBeforeUnmount(() => cancelAnimationFrame(frame))

function onDown(e: PointerEvent) {
  const box = root.value?.getBoundingClientRect()
  if (!box) return
  const move = (ev: PointerEvent) => (at.value = dividerAt(ev.clientX, box.left, box.width))
  move(e)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
</script>
