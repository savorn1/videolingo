<template>
  <div
    v-if="durationMs && edit.state.layers.length"
    ref="root"
    class="relative rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 select-none touch-none"
    data-testid="overlay-timeline"
    @pointerdown.self="seekAt"
  >
    <div
      v-for="l in edit.state.layers"
      :key="l.id"
      class="relative h-6 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
      @pointerdown.self="seekAt"
    >
      <div
        class="absolute inset-y-1 flex items-center overflow-hidden rounded text-[10px] leading-none text-white cursor-grab active:cursor-grabbing"
        :class="l.id === edit.state.selectedId ? 'bg-primary-500 ring-2 ring-primary-300' : edit.state.multi.includes(l.id) ? 'bg-primary-500 ring-2 ring-sky-300' : 'bg-primary-400/80 dark:bg-primary-600/80'"
        :style="bar(l)"
        :title="`${formatTimecode(l.startMs)} – ${l.endMs == null ? 'end' : formatTimecode(l.endMs)} · drag to move, drag the ends to trim`"
        @pointerdown.stop.prevent="onDown(l, 'move', $event)"
      >
        <span class="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-white/30" @pointerdown.stop.prevent="onDown(l, 'start', $event)" />
        <span class="mx-2.5 truncate pointer-events-none">{{ l.kind === 'TEXT' ? l.text : l.imageName }}</span>
        <span v-if="l.endMs != null" class="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/30" @pointerdown.stop.prevent="onDown(l, 'end', $event)" />
      </div>
    </div>
    <div class="pointer-events-none absolute inset-y-0 w-px bg-error-500" :style="{ left: `${pct(currentMs)}%` }" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
// Every layer as a bar on the video's time axis: drag a bar to move it, its
// ends to trim it, an empty spot to move the playhead. Snaps to the playhead
// and to the start/end of the video.
import type { EditorLayer, OverlayEdit } from '~/composables/useOverlayEdit'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ edit: OverlayEdit; durationMs: number; currentMs: number }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const root = useTemplateRef<HTMLDivElement>('root')
const MIN = 100
const SNAP_PX = 6

const pct = (ms: number) => Math.min(100, Math.max(0, (ms / (props.durationMs || 1)) * 100))

function bar(l: EditorLayer) {
  const start = pct(l.startMs)
  const end = pct(l.endMs ?? props.durationMs)
  return { left: `${start}%`, width: `max(${Math.max(end - start, 0)}%, 8px)` }
}

function seekAt(e: PointerEvent) {
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  emit('seek', Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * props.durationMs))
}

function onDown(l: EditorLayer, part: 'move' | 'start' | 'end', e: PointerEvent) {
  if (e.button !== 0) return
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    props.edit.toggleMulti(l.id)
    return
  }
  if (!props.edit.isPicked(l.id)) props.edit.select(l.id)
  // Moving a bar of the group moves every picked bar by the same time.
  const mates = part === 'move' ? props.edit.group.value.filter((g) => g.id !== l.id).map((g) => ({ g, start: g.startMs, end: g.endMs })) : []
  const width = root.value?.getBoundingClientRect().width || 1
  const msPerPx = props.durationMs / width
  const snapMs = SNAP_PX * msPerPx
  const total = props.durationMs
  const start0 = l.startMs
  const end0 = l.endMs ?? total
  const from = e.clientX
  const snap = (ms: number) => {
    for (const t of [0, total, props.currentMs]) if (Math.abs(ms - t) <= snapMs) return t
    return ms
  }
  const move = (ev: PointerEvent) => {
    const d = (ev.clientX - from) * msPerPx
    if (part === 'start') {
      l.startMs = Math.round(Math.min(end0 - MIN, Math.max(0, snap(start0 + d))))
    } else if (part === 'end') {
      l.endMs = Math.round(Math.min(total, Math.max(start0 + MIN, snap(end0 + d))))
    } else {
      const len = end0 - start0
      const s = Math.min(total - len, Math.max(0, snap(start0 + d)))
      const startMs = Math.round(l.endMs == null ? Math.min(total - MIN, Math.max(0, start0 + d)) : s)
      l.startMs = startMs
      if (l.endMs != null) l.endMs = startMs + len
      const delta = startMs - start0
      for (const m of mates) {
        const mlen = (m.end ?? total) - m.start
        const ms = Math.min(total - Math.min(mlen, total), Math.max(0, m.start + delta))
        m.g.startMs = Math.round(ms)
        if (m.end != null) m.g.endMs = Math.round(ms + mlen)
      }
    }
  }
  const up = () => window.removeEventListener('pointermove', move)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
}
</script>
