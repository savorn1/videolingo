<template>
  <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="shrink-0 rounded-sm bg-gray-800" aria-hidden="true">
    <rect
      v-for="(l, i) in layers"
      :key="i"
      :x="rect(l).x"
      :y="rect(l).y"
      :width="rect(l).w"
      :height="rect(l).h"
      :rx="l.kind === 'IMAGE' ? 1 : 2"
      :fill="fill(l)"
      :fill-opacity="l.opacity"
      :stroke="l.kind === 'IMAGE' ? '#94a3b8' : 'none'"
      stroke-width="0.6"
    />
  </svg>
</template>

<script setup lang="ts">
// A quick, approximate preview of a template's layout — not a pixel-accurate
// render (that needs the server's fonts and a real frame), just enough to
// tell templates apart at a glance in the saved-templates list.
import type { EditorLayer } from '~/composables/useOverlayEdit'

const props = defineProps<{ layers: EditorLayer[] }>()
const W = 64
const H = 36

function rect(l: EditorLayer) {
  if (l.kind === 'IMAGE') {
    const w = (l.widthPct / 100) * W
    const h = w * 0.6 // unknown real aspect ratio — a plausible stand-in
    return { x: l.x * W - w / 2, y: l.y * H - h / 2, w, h }
  }
  const lines = (l.text ?? '').split('\n')
  const lineH = Math.max(2, (l.sizePct / 100) * H)
  const w = Math.min(W - 2, Math.max(...lines.map((s) => s.length), 1) * lineH * 0.55)
  const h = lineH * lines.length
  return { x: l.x * W - w / 2, y: l.y * H - h / 2, w, h }
}

function fill(l: EditorLayer) {
  if (l.kind === 'IMAGE') return '#475569'
  return l.background && l.backgroundOpacity > 0 ? l.background : (l.color ?? '#ffffff')
}
</script>
