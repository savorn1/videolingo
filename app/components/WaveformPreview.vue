<template>
  <svg viewBox="0 0 100 25" :preserveAspectRatio="mini ? 'xMidYMid meet' : 'none'" class="wf" :class="{ 'wf-still': still }" aria-hidden="true">
    <!-- Bars and spectrum: columns rising and falling from the bottom, each on its own beat -->
    <template v-if="kind === 'BARS'">
      <rect
        v-for="(h, i) in BARS"
        :key="i"
        class="wf-rise"
        :x="i * 4 + 1"
        :y="25 - h"
        width="2.6"
        :height="h"
        :fill="color"
        :style="{ animationDelay: `${(i % 8) * -140}ms` }"
      />
    </template>
    <template v-else-if="kind === 'SPECTRUM'">
      <polyline
        class="wf-rise wf-slow"
        :points="SPECTRUM"
        fill="none"
        :stroke="color"
        stroke-width="0.8"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </template>
    <!-- Spikes: sticks grown out from the middle line -->
    <template v-else-if="kind === 'SPIKES'">
      <line
        v-for="(h, i) in SPIKES"
        :key="i"
        class="wf-grow"
        :x1="i * 2 + 1"
        :x2="i * 2 + 1"
        :y1="12.5 - h / 2"
        :y2="12.5 + h / 2"
        :stroke="color"
        stroke-width="0.9"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
        :style="{ animationDelay: `${(i % 9) * -110}ms` }"
      />
    </template>
    <!-- Dots: a row of points bobbing along the wave -->
    <template v-else-if="kind === 'DOTS'">
      <circle
        v-for="(y, i) in DOTS"
        :key="i"
        class="wf-bob"
        :cx="i * 3 + 1.5"
        :cy="y"
        r="0.9"
        :fill="color"
        :style="{ animationDelay: `${(i % 10) * -120}ms` }"
      />
    </template>
    <!-- Mirrored bars (pulse, blocks, fine, stripes): swelling in waves around the middle line -->
    <template v-else-if="kind in MIRRORED">
      <rect
        v-for="(h, i) in MIRRORED[kind]!.heights"
        :key="i"
        class="wf-grow"
        :x="2 + i * MIRRORED[kind]!.pitch"
        :y="12.5 - h / 2"
        :width="MIRRORED[kind]!.bar"
        :height="h"
        :rx="MIRRORED[kind]!.bar / 2.2"
        :fill="color"
        :style="{ animationDelay: `${(i % 12) * -90}ms` }"
      />
    </template>
    <!-- Waveform: a long wave sliding past -->
    <g v-else>
      <polyline class="wf-slide" :points="WAVE" fill="none" :stroke="color" stroke-width="0.8" vector-effect="non-scaling-stroke" />
    </g>
  </svg>
</template>

<script setup lang="ts">
// A small moving picture of a waveform style — on the "Video from audio" page both the big
// preview and the style buttons use it. It is only a sketch of the look (the real one is drawn
// from the sound by the server); it stands still for people who ask for less motion.
defineProps<{ kind: string; color: string; mini?: boolean; still?: boolean }>()

const BARS = [6, 12, 9, 18, 14, 22, 10, 16, 20, 8, 15, 21, 11, 17, 9, 13, 19, 7, 12, 10, 14, 6, 9, 5]
const SPIKES = Array.from({ length: 50 }, (_, i) => 2 + 9 * Math.abs(Math.sin(i * 0.6) * Math.cos(i * 0.21)) + (i % 5 === 0 ? 3 : 0))
// Mirrored bars with a swelling shape, like speech: a few louder swells with quiet stretches between.
const envelope = (i: number, n: number) => 0.12 + 0.88 * Math.abs(Math.sin((i / n) * Math.PI * 3.2)) ** 1.4 * (0.55 + 0.45 * Math.abs(Math.cos(i * 0.9)))
// Per style: how many bars, how far apart (in the 100-wide sketch) and how wide.
const MIRRORED: Record<string, { heights: number[]; pitch: number; bar: number }> = {
  PULSE: { heights: Array.from({ length: 41 }, (_, i) => 1.5 + 21 * envelope(i, 41)), pitch: 2.35, bar: 0.9 },
  BLOCKS: { heights: Array.from({ length: 18 }, (_, i) => 2 + 20 * envelope(i, 18)), pitch: 5.4, bar: 3.2 },
  FINE: { heights: Array.from({ length: 64 }, (_, i) => 1.2 + 21 * envelope(i, 64)), pitch: 1.5, bar: 0.5 },
  STRIPES: { heights: Array.from({ length: 28 }, (_, i) => 1.8 + 20 * envelope(i, 28)), pitch: 3.5, bar: 1.7 }
}
const SPECTRUM = Array.from({ length: 51 }, (_, i) => `${i * 2},${24 - (3 + 17 * Math.abs(Math.sin(i * 0.23) * Math.cos(i * 0.07 + 1)))}`).join(' ')
const DOTS = Array.from({ length: 34 }, (_, i) => 12.5 - Math.sin(i * 0.55) * (3 + 7 * Math.abs(Math.sin(i * 0.17))))
// Two periods long, so sliding one period across looks endless.
const WAVE = Array.from({ length: 101 }, (_, i) => `${i * 2},${12.5 - Math.sin(i * 0.9) * (3 + 6 * Math.abs(Math.sin(i * 0.17 * 2)))}`).join(' ')
</script>

<style scoped>
.wf {
  overflow: hidden;
}
.wf-rise,
.wf-grow,
.wf-bob,
.wf-slide {
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
.wf-rise {
  transform-box: fill-box;
  transform-origin: bottom;
  animation-name: wf-rise;
  animation-duration: calc(1.1s / var(--anim-speed, 1));
}
.wf-slow {
  animation-duration: calc(1.8s / var(--anim-speed, 1));
}
.wf-grow {
  transform-box: fill-box;
  transform-origin: center;
  animation-name: wf-grow;
  animation-duration: calc(0.95s / var(--anim-speed, 1));
}
.wf-bob {
  animation-name: wf-bob;
  animation-duration: calc(1.2s / var(--anim-speed, 1));
}
.wf-slide {
  animation-name: wf-slide;
  animation-duration: calc(2.4s / var(--anim-speed, 1));
  animation-timing-function: linear;
}
@keyframes wf-rise {
  0%,
  100% {
    transform: scaleY(0.25);
  }
  50% {
    transform: scaleY(1);
  }
}
@keyframes wf-grow {
  0%,
  100% {
    transform: scaleY(0.2);
  }
  50% {
    transform: scaleY(1);
  }
}
@keyframes wf-bob {
  0%,
  100% {
    transform: translateY(-2.5px);
  }
  50% {
    transform: translateY(2.5px);
  }
}
@keyframes wf-slide {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-60px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wf-rise,
  .wf-grow,
  .wf-bob,
  .wf-slide {
    animation: none;
  }
}
.wf-still .wf-rise,
.wf-still .wf-grow,
.wf-still .wf-bob,
.wf-still .wf-slide {
  animation: none;
}
</style>
