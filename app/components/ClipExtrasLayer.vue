<template>
  <div ref="root" class="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="clip-extras-layer">
    <!-- Blurred areas (the one being edited is drawn by the crop box in its blur mode) -->
    <div
      v-for="(b, i) in blurs"
      v-show="i !== editingIndex"
      :key="i"
      class="absolute rounded-sm border border-dashed border-white/60 backdrop-blur-md"
      :style="rectStyle(b)"
    />
    <!-- The video in the corner, as its thumbnail -->
    <div v-if="pipBox" class="absolute overflow-hidden rounded-sm bg-gray-700 shadow-lg ring-1 ring-white/70" :style="pipBox.style">
      <img v-if="pip?.thumbnailUrl" :src="pip.thumbnailUrl" alt="" class="size-full object-cover" />
      <span v-else class="flex size-full items-center justify-center text-[10px] text-white">{{ pip?.title ?? 'Video' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// The Trim tab's preview of blurred areas and the picture in picture, over the player.
// The real blur and the second video's picture are only in the rendered result.
import type { BlurBox, PipSettings } from '#shared/utils/clipExtras'

const props = defineProps<{
  naturalWidth: number
  naturalHeight: number
  blurs: BlurBox[]
  editingIndex: number | null
  pip: PipSettings | null
}>()

const root = ref<HTMLElement | null>(null)
const { picture, rectStyle } = usePictureBox(
  root,
  () => props.naturalWidth,
  () => props.naturalHeight
)

// Same placement as the server: its width a share of the picture's, 16:9, 3 % margin from the corner.
const pipBox = computed(() => {
  const p = picture.value
  const s = props.pip
  if (!p || !s || s.videoId == null) return null
  const w = (p.width * s.sizePct) / 100
  const h = (w * 9) / 16
  const m = p.width * 0.03
  const left = s.corner.endsWith('LEFT') ? p.left + m : p.left + p.width - w - m
  const top = s.corner.startsWith('TOP') ? p.top + m : p.top + p.height - h - m
  return { style: { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` } }
})
</script>
