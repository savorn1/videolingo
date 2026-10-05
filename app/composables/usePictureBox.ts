// Where a video's picture sits inside an element over the player: <video>
// letterboxes (object-fit: contain), so a 4:3 video in the 16:9 player has bars
// at the sides. Layers drawn in video pixels map through this rect (the same
// sums as CropOverlay). The size is the layout size, unaffected by zoom transforms.

import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function usePictureBox(root: Ref<HTMLElement | null>, naturalWidth: () => number, naturalHeight: () => number) {
  const size = ref({ w: 0, h: 0 })
  let observer: ResizeObserver | null = null
  onMounted(() => {
    if (!root.value) return
    size.value = { w: root.value.offsetWidth, h: root.value.offsetHeight }
    observer = new ResizeObserver(([entry]) => {
      if (entry) size.value = { w: entry.contentRect.width, h: entry.contentRect.height }
    })
    observer.observe(root.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  const picture = computed(() => {
    const { w, h } = size.value
    const nw = naturalWidth()
    const nh = naturalHeight()
    if (!w || !h || !nw || !nh) return null
    const scale = Math.min(w / nw, h / nh)
    return { left: (w - nw * scale) / 2, top: (h - nh * scale) / 2, width: nw * scale, height: nh * scale, scale }
  })

  /** CSS for a rectangle given in video pixels. */
  function rectStyle(r: { x: number; y: number; w: number; h: number }) {
    const p = picture.value
    if (!p) return { display: 'none' }
    return { left: `${p.left + r.x * p.scale}px`, top: `${p.top + r.y * p.scale}px`, width: `${r.w * p.scale}px`, height: `${r.h * p.scale}px` }
  }

  return { picture, rectStyle }
}
