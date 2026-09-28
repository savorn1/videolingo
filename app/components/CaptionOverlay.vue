<template>
  <div
    v-if="lines.length"
    class="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-1 px-6"
    :class="captionStyle.position === 'top' ? 'top-4' : fill ? 'bottom-20' : 'bottom-14'"
  >
    <template v-for="line in lines" :key="line.key">
      <div
        class="pointer-events-auto max-w-full rounded px-2 py-0.5 text-center whitespace-pre-line leading-snug transition-[filter]"
        :class="[line.secondary ? 'text-yellow-200' : 'text-white font-semibold', practice === 'hover' ? 'blur-sm hover:blur-none' : '']"
        :style="{
          fontSize: `${fontRem(line.secondary)}rem`,
          backgroundColor: `rgba(0,0,0,${captionStyle.background / 100})`,
          fontFamily: FONTS[captionStyle.font]
        }"
        @mouseenter="emit('hover', true)"
        @mouseleave="emit('hover', false)"
      >
        <!-- Main line: every word can be clicked to look it up. -->
        <template v-if="!line.secondary">
          <template v-for="(piece, k) in line.pieces" :key="k">
            <UTooltip v-if="piece.word && line.glossary[k]" :text="glossaryTip(line.glossary[k]!)" :content="{ side: 'top' }">
              <button
                type="button"
                class="rounded-sm underline decoration-sky-300 decoration-2 underline-offset-4 hover:bg-white/20"
                :class="k === line.activeWord ? 'text-primary-300' : ''"
                @click="lookup(piece.text, line)"
              >
                {{ piece.text }}
              </button>
            </UTooltip>
            <button
              v-else-if="piece.word"
              type="button"
              class="rounded-sm hover:bg-white/20"
              :class="k === line.activeWord ? 'text-primary-300' : ''"
              @click="lookup(piece.text, line)"
            >
              {{ piece.text }}</button
            ><template v-else>{{ piece.text }}</template>
          </template>
        </template>
        <template v-else>{{ line.text }}</template>
      </div>
    </template>
    <span v-if="listening" class="pointer-events-none rounded bg-black/50 px-2 py-0.5 text-xs text-white/80">🎧 Listen — the line appears when it's done</span>
  </div>
</template>

<script setup lang="ts">
// Captions drawn over a learner's video: one or two languages, words that can
// be clicked for a lookup, glossary terms underlined, the current word lit up,
// and practice modes (blurred until hovered, shown only after each line,
// translation only). Styled by the learner's caption settings.
import type { GlossaryTermRule } from '#shared/utils/glossary'
import type { TextPiece } from '#shared/utils/words'
import type { LearnCue } from '~/composables/useLearn'
import type { CaptionStyle, PracticeMode } from '~/composables/useLearnerPrefs'

const props = defineProps<{
  primaryCues: LearnCue[]
  secondaryCues: LearnCue[]
  currentMs: number
  language?: string | null
  captionStyle: CaptionStyle
  practice: PracticeMode
  wordHighlight?: boolean
  glossaryTerms?: GlossaryTermRule[]
  /** The player fills the screen — everything gets bigger. */
  fill?: boolean
}>()
const emit = defineEmits<{ hover: [boolean]; lookup: [{ word: string; context: string; atMs: number }] }>()

const SIZES = { s: 0.9, m: 1.1, l: 1.4, xl: 1.8 } as const
const FONTS = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, "Noto Serif Khmer", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'
} as const
const fontRem = (secondary: boolean) => SIZES[props.captionStyle.size] * (props.fill ? 1.6 : 1) * (secondary ? 0.85 : 1)

interface Line {
  key: string
  secondary: boolean
  text: string
  cue: LearnCue
  pieces: TextPiece[]
  glossary: (GlossaryTermRule | null)[]
  activeWord: number
}

// Which cue each language shows: the one being spoken, or in "reveal" mode the last one finished.
const primaryIndex = computed(() =>
  props.practice === 'reveal' ? revealedCueIndex(props.primaryCues, props.currentMs) : activeCueIndex(props.primaryCues, props.currentMs)
)
// "Listen" hint in reveal mode, while a line is being spoken but not shown yet.
const listening = computed(() => props.practice === 'reveal' && activeCueIndex(props.primaryCues, props.currentMs) >= 0 && props.primaryCues.length > 0)

function secondaryFor(cue: LearnCue | null) {
  if (!props.secondaryCues.length) return null
  if (!cue) return props.practice === 'translation' ? (props.secondaryCues[activeCueIndex(props.secondaryCues, props.currentMs)] ?? null) : null
  const mid = (cue.startMs + cue.endMs) / 2
  return props.secondaryCues.find((c) => c.startMs <= mid && mid < c.endMs) ?? null
}

const lines = computed<Line[]>(() => {
  const cue = props.primaryCues[primaryIndex.value] ?? null
  const main: Line | null =
    cue && props.practice !== 'translation'
      ? (() => {
          const pieces = splitWords(cue.text, props.language)
          return {
            key: `p-${cue.startMs}`,
            secondary: false,
            text: cue.text,
            cue,
            pieces,
            glossary: props.glossaryTerms?.length ? glossaryPieces(pieces, props.glossaryTerms) : pieces.map(() => null),
            activeWord: props.wordHighlight && props.practice !== 'reveal' ? activeWordIndex(pieces, cue, props.currentMs) : -1
          }
        })()
      : null
  const sc = secondaryFor(cue)
  const second: Line | null = sc ? { key: `s-${sc.startMs}`, secondary: true, text: sc.text, cue: sc, pieces: [], glossary: [], activeWord: -1 } : null
  const ordered = props.captionStyle.secondary === 'above' ? [second, main] : [main, second]
  return ordered.filter((l): l is Line => !!l)
})

function lookup(word: string, line: Line) {
  emit('lookup', { word, context: line.text, atMs: line.cue.startMs })
}

function glossaryTip(t: GlossaryTermRule) {
  return t.doNotTranslate ? `${t.source} — keep as is` : `${t.source} → ${t.target}${t.note ? ` (${t.note})` : ''}`
}
</script>
