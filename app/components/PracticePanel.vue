<template>
  <UCard data-testid="practice-panel">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-gray-900 dark:text-white">Practice</h2>
        <div class="flex gap-1">
          <UButton
            v-for="m in MODES"
            :key="m.value"
            size="xs"
            :icon="m.icon"
            :color="mode === m.value ? 'primary' : 'neutral'"
            :variant="mode === m.value ? 'soft' : 'ghost'"
            @click="mode = m.value"
          >
            {{ m.label }}
          </UButton>
        </div>
      </div>
    </template>

    <EmptyState v-if="!cues.length" icon="i-lucide-mic" title="No lines to practise" description="This video needs subtitles first." class="py-4" />

    <div v-else class="space-y-3">
      <!-- The line -->
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-left"
          aria-label="Previous line"
          :disabled="index <= 0"
          @click="go(index - 1)"
        />
        <span class="tabular-nums" data-testid="practice-line-no">Line {{ index + 1 }} of {{ cues.length }}</span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-right"
          aria-label="Next line"
          :disabled="index >= cues.length - 1"
          @click="go(index + 1)"
        />
        <UButton size="xs" color="neutral" variant="link" class="ml-auto" @click="go(lineNow)">Go to the line playing</UButton>
      </div>
      <p
        v-if="mode === 'shadow' || revealed"
        class="rounded-md bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-base text-gray-900 dark:text-white"
        data-testid="practice-line"
      >
        {{ line?.text }}
      </p>
      <p v-else class="rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
        Listen, then type what you hear.
      </p>

      <div class="flex flex-wrap gap-2">
        <UButton size="sm" icon="i-lucide-play" @click="playLine(false)">Play line</UButton>
        <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-snail" @click="playLine(true)">Slower</UButton>
      </div>

      <!-- ── Shadowing ─────────────────────────────────────────────────── -->
      <template v-if="mode === 'shadow'">
        <p v-if="micError" class="text-xs text-error-600 dark:text-error-400">{{ micError }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <UButton v-if="!recording" size="sm" color="error" variant="soft" icon="i-lucide-mic" @click="startRecording">
            {{ recordingUrl ? 'Record again' : 'Record yourself' }}
          </UButton>
          <UButton v-else size="sm" color="error" icon="i-lucide-square" @click="stopRecording">Stop ({{ recordSeconds }}s)</UButton>
          <template v-if="recordingUrl && !recording">
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-user-round" @click="playMine">Play mine</UButton>
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-arrow-right-left" @click="playBoth">Original, then mine</UButton>
            <UButton size="sm" icon="i-lucide-sparkles" :loading="checking" data-testid="check-pronunciation" @click="checkPronunciation">
              Check pronunciation
            </UButton>
          </template>
        </div>
        <audio v-if="recordingUrl" ref="mine" :src="recordingUrl" class="hidden" />
        <p v-if="heardError" class="text-xs text-error-600 dark:text-error-400">{{ heardError }}</p>
        <div v-if="heard !== null" class="space-y-1" data-testid="pronunciation-result">
          <p class="text-xs text-gray-500">
            Heard: <span class="text-gray-800 dark:text-gray-200">“{{ heard || '(nothing)' }}”</span>
          </p>
          <DiffLine :result="result!" />
        </div>
      </template>

      <!-- ── Dictation ─────────────────────────────────────────────────── -->
      <template v-else>
        <UTextarea
          v-model="typed"
          :rows="2"
          autoresize
          placeholder="Type what you hear…"
          aria-label="Your answer"
          class="w-full"
          @keydown.enter.exact.prevent="checkDictation"
        />
        <div class="flex flex-wrap gap-2">
          <UButton size="sm" icon="i-lucide-check" :disabled="!typed.trim()" @click="checkDictation">Check</UButton>
          <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-eye" @click="revealed = true">Show the line</UButton>
          <UButton
            v-if="result"
            size="sm"
            color="neutral"
            variant="soft"
            trailing-icon="i-lucide-arrow-right"
            :disabled="index >= cues.length - 1"
            @click="go(index + 1)"
          >
            Next line
          </UButton>
        </div>
        <DiffLine v-if="result" :result="result" data-testid="dictation-result" />
      </template>
    </div>
  </UCard>
</template>

<script setup lang="ts">
// Speaking and listening practice on the video's own lines. Shadowing: play
// a line, record yourself saying it, compare by ear — and, when the server
// has speech-to-text, see which words came through. Dictation: listen, type
// it, and get a word-by-word check. Both use diffWords.
import { diffWords, type DiffResult } from '#shared/utils/wordDiff'

interface Line {
  startMs: number
  endMs: number
  text: string
}

const props = defineProps<{ cues: Line[]; currentMs: number; language?: string | null }>()
const emit = defineEmits<{ play: [range: { startMs: number; endMs: number; slow: boolean }] }>()

const MODES = [
  { label: 'Shadowing', value: 'shadow', icon: 'i-lucide-mic' },
  { label: 'Dictation', value: 'dictation', icon: 'i-lucide-keyboard' }
] as const
const MAX_RECORD_MS = 30_000

const { pronunciation } = useLearn()
const mode = ref<'shadow' | 'dictation'>('shadow')
const index = ref(0)
const line = computed(() => props.cues[index.value] ?? null)
const lineNow = computed(() => {
  const i = props.cues.findIndex((c) => props.currentMs >= c.startMs && props.currentMs < c.endMs)
  if (i >= 0) return i
  const next = props.cues.findIndex((c) => c.startMs > props.currentMs)
  return next >= 0 ? next : props.cues.length - 1
})

const result = ref<DiffResult | null>(null)
const revealed = ref(false)
const typed = ref('')
const heard = ref<string | null>(null)
const heardError = ref('')

function clearAttempt() {
  result.value = null
  revealed.value = false
  typed.value = ''
  heard.value = null
  heardError.value = ''
  dropRecording()
}
function go(i: number) {
  index.value = Math.min(Math.max(0, i), props.cues.length - 1)
  clearAttempt()
}
watch(mode, clearAttempt)
// Start on the line that's playing when the panel first has lines.
watch(
  () => props.cues.length,
  (n) => n && (index.value = Math.min(lineNow.value, n - 1)),
  { immediate: true }
)

function playLine(slow: boolean) {
  if (line.value) emit('play', { startMs: line.value.startMs, endMs: line.value.endMs, slow })
}

// ── Dictation ────────────────────────────────────────────────────────────────
function checkDictation() {
  if (!line.value || !typed.value.trim()) return
  result.value = diffWords(line.value.text, typed.value)
}

// ── Shadowing: record ────────────────────────────────────────────────────────
const recording = ref(false)
const recordSeconds = ref(0)
const recordingUrl = ref<string | null>(null)
const micError = ref('')
const mine = useTemplateRef<HTMLAudioElement>('mine')
let recorder: MediaRecorder | null = null
let blob: Blob | null = null
let tick: ReturnType<typeof setInterval> | undefined
let limit: ReturnType<typeof setTimeout> | undefined

function dropRecording() {
  if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value)
  recordingUrl.value = null
  blob = null
}

async function startRecording() {
  micError.value = ''
  heard.value = null
  heardError.value = ''
  result.value = null
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    micError.value = "This browser can't record audio."
    return
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    micError.value = 'Allow the microphone to record yourself (check the permission in the address bar).'
    return
  }
  const chunks: Blob[] = []
  recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop())
    clearInterval(tick)
    clearTimeout(limit)
    recording.value = false
    dropRecording()
    blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
    recordingUrl.value = URL.createObjectURL(blob)
  }
  recorder.start()
  recording.value = true
  recordSeconds.value = 0
  tick = setInterval(() => recordSeconds.value++, 1000)
  limit = setTimeout(stopRecording, MAX_RECORD_MS)
}

function stopRecording() {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
}

function playMine() {
  if (!mine.value) return
  mine.value.currentTime = 0
  mine.value.play().catch(() => {})
}

let bothTimer: ReturnType<typeof setTimeout> | undefined
function playBoth() {
  if (!line.value) return
  playLine(false)
  clearTimeout(bothTimer)
  bothTimer = setTimeout(playMine, line.value.endMs - line.value.startMs + 400)
}

onBeforeUnmount(() => {
  stopRecording()
  clearTimeout(bothTimer)
  dropRecording()
})

// ── Shadowing: check ─────────────────────────────────────────────────────────
const checking = ref(false)
async function checkPronunciation() {
  if (!blob || !line.value) return
  checking.value = true
  heardError.value = ''
  try {
    const { text } = await pronunciation(blob, props.language)
    heard.value = text
    result.value = diffWords(line.value.text, text)
  } catch (err) {
    heardError.value = apiErrorMessage(err)
  } finally {
    checking.value = false
  }
}
</script>
