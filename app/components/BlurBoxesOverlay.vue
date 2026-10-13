<template>
  <div ref="root" class="absolute inset-0 z-10 select-none" data-testid="blur-boxes">
    <div
      v-for="(b, i) in boxes"
      :key="i"
      class="absolute cursor-move border-2 border-dashed border-white/80 backdrop-blur-md"
      :style="boxStyle(b)"
      :title="`Blurred area ${i + 1} — drag to move, drag the corner to resize`"
      @pointerdown.stop.prevent="start(i, 'move', $event)"
    >
      <span class="pointer-events-none absolute left-0 top-0 rounded-br bg-black/60 px-1 text-[10px] text-white">{{ i + 1 }}</span>
      <span
        class="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-gray-900/40 bg-white"
        @pointerdown.stop.prevent="start(i, 'resize', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// The blurred areas of a trim drawn over the preview (blurred there too, as a guide): drag one to move it, its
// corner to resize it. In the original picture's pixels, mapped onto the letterboxed picture.
import { containRect } from '#shared/utils/lookCompare'
import { MIN_BLUR_SIZE, type BlurBox } from '#shared/utils/trimExtras'

const props = defineProps<{ naturalWidth: number; naturalHeight: number }>()
const boxes = defineModel<BlurBox[]>({ required: true })
const root = useTemplateRef<HTMLDivElement>('root')

function picture() {
  const el = root.value
  return containRect(el?.clientWidth ?? 0, el?.clientHeight ?? 0, props.naturalWidth, props.naturalHeight)
}
function boxStyle(b: BlurBox) {
  const p = picture()
  const k = p.w / Math.max(1, props.naturalWidth)
  return { left: `${p.x + b.x * k}px`, top: `${p.y + b.y * k}px`, width: `${b.w * k}px`, height: `${b.h * k}px` }
}

function start(i: number, what: 'move' | 'resize', e: PointerEvent) {
  const p = picture()
  const k = Math.max(1, props.naturalWidth) / Math.max(1, p.w)
  const from = { x: e.clientX, y: e.clientY, box: { ...boxes.value[i]! } }
  const move = (ev: PointerEvent) => {
    const dx = Math.round((ev.clientX - from.x) * k)
    const dy = Math.round((ev.clientY - from.y) * k)
    const b = { ...from.box }
    if (what === 'move') {
      b.x = Math.min(Math.max(0, b.x + dx), props.naturalWidth - b.w)
      b.y = Math.min(Math.max(0, b.y + dy), props.naturalHeight - b.h)
    } else {
      b.w = Math.min(Math.max(MIN_BLUR_SIZE, b.w + dx), props.naturalWidth - b.x)
      b.h = Math.min(Math.max(MIN_BLUR_SIZE, b.h + dy), props.naturalHeight - b.y)
    }
    boxes.value = boxes.value.map((x, j) => (j === i ? b : x))
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
</script>
