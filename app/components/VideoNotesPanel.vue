<template>
  <UCard :ui="{ body: 'space-y-3' }" data-testid="video-notes">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-message-square-text" class="size-4 text-amber-600 dark:text-amber-400" />
        <h3 class="font-semibold text-gray-900 dark:text-white">Review notes</h3>
        <UBadge v-if="openCount" color="warning" variant="subtle" size="sm">{{ openCount }} open</UBadge>
      </div>
    </template>

    <p v-if="error" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ error }}</p>
    <USkeleton v-else-if="notes === null" class="h-12 w-full" />
    <p v-else-if="!notes.length" class="text-sm text-gray-500 dark:text-gray-400">
      No notes yet. Leave one for whoever works on this video next — learners never see them.
    </p>

    <ul v-if="notes?.length" class="space-y-2">
      <li
        v-for="n in shown"
        :key="n.id"
        class="rounded-lg border px-3 py-2"
        :class="
          n.resolved
            ? 'border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/40'
            : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20'
        "
      >
        <div class="flex items-start gap-2">
          <UserAvatar :name="n.author" size="2xs" class="mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              <button
                v-if="n.atMs != null"
                type="button"
                class="mr-1 rounded bg-primary-50 px-1 font-medium tabular-nums text-primary-700 hover:bg-primary-100 dark:bg-primary-950/50 dark:text-primary-300"
                :title="`Play from ${formatTimecode(n.atMs)}`"
                @click="emit('seek', n.atMs)"
              >
                {{ formatTimecode(n.atMs) }}
              </button>
              <span class="font-medium text-gray-700 dark:text-gray-300">{{ n.author }}</span> · {{ formatDateTime(n.createdAt) }}
              <template v-if="n.resolved"> · resolved by {{ n.resolvedBy }}</template>
            </p>
            <p
              class="whitespace-pre-line text-sm"
              :class="n.resolved ? 'text-gray-500 line-through decoration-gray-300 dark:text-gray-400' : 'text-gray-900 dark:text-white'"
            >
              {{ n.body }}
            </p>
          </div>
          <div v-if="canWrite" class="flex shrink-0 items-center">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="n.resolved ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
              :aria-label="n.resolved ? 'Reopen note' : 'Resolve note'"
              :title="n.resolved ? 'Reopen' : 'Resolve'"
              :loading="busyId === n.id"
              @click="toggle(n)"
            />
            <UButton
              v-if="isAdmin || n.author === username"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              aria-label="Delete note"
              title="Delete"
              @click="onDelete(n)"
            />
          </div>
        </div>
      </li>
    </ul>
    <UButton v-if="resolvedCount" size="xs" color="neutral" variant="link" :padded="false" @click="showResolved = !showResolved">
      {{ showResolved ? 'Hide resolved' : `Show ${resolvedCount} resolved` }}
    </UButton>

    <form v-if="canWrite" class="space-y-2" @submit.prevent="onAdd">
      <UTextarea
        v-model="draft"
        :rows="2"
        autoresize
        :maxrows="8"
        :maxlength="2000"
        placeholder="e.g. The intro music is too loud — fix before enabling"
        class="w-full"
        aria-label="New note"
        @keydown.meta.enter="onAdd"
        @keydown.ctrl.enter="onAdd"
      />
      <div class="flex items-center justify-between gap-2">
        <UCheckbox v-model="atNow" :label="`At ${formatTimecode(Math.round(currentMs ?? 0))}`" :disabled="currentMs == null" data-testid="note-at-time" />
        <UButton type="submit" size="sm" icon="i-lucide-send" :loading="adding" :disabled="!draft.trim()">Add note</UButton>
      </div>
    </form>
  </UCard>
</template>

<script setup lang="ts">
// Review notes on a video (VideoNoteController): open ones first, resolved ones folded away.
import type { VideoNote } from '~/composables/useVideoNotes'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ videoId: number; canWrite: boolean; currentMs?: number | null }>()
const emit = defineEmits<{ seek: [ms: number] }>()
/** Ties a new note to where the video is (on by default once it has been played). */
const atNow = ref(false)
watch(
  () => (props.currentMs ?? 0) > 0,
  (playing) => playing && (atNow.value = true)
)

const { list, add, setResolved, remove } = useVideoNotes()
const { username, isAdmin } = useAuth()
const { del } = useUndoableDelete()
const toast = useToast()

const notes = ref<VideoNote[] | null>(null)
const error = ref('')
const draft = ref('')
const adding = ref(false)
const busyId = ref<number | null>(null)
const showResolved = ref(false)

const openCount = computed(() => notes.value?.filter((n) => !n.resolved).length ?? 0)
const resolvedCount = computed(() => notes.value?.filter((n) => n.resolved).length ?? 0)
const shown = computed(() => (notes.value ?? []).filter((n) => !n.resolved || showResolved.value))

async function load() {
  error.value = ''
  try {
    notes.value = await list(props.videoId)
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
}
watch(() => props.videoId, load, { immediate: true })

async function onAdd() {
  const body = draft.value.trim()
  if (!body || adding.value) return
  adding.value = true
  try {
    const atMs = atNow.value && props.currentMs != null ? Math.round(props.currentMs) : null
    notes.value = [...(notes.value ?? []), await add(props.videoId, body, atMs)]
    draft.value = ''
  } catch (err) {
    toast.add({ title: 'Could not add the note', description: apiErrorMessage(err), color: 'error' })
  } finally {
    adding.value = false
  }
}

async function toggle(n: VideoNote) {
  busyId.value = n.id
  try {
    const updated = await setResolved(props.videoId, n.id, !n.resolved)
    notes.value = (notes.value ?? []).map((x) => (x.id === n.id ? updated : x))
  } catch (err) {
    toast.add({ title: 'Could not update the note', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

function onDelete(n: VideoNote) {
  const before = notes.value ?? []
  notes.value = before.filter((x) => x.id !== n.id)
  del('Note', { commit: () => remove(props.videoId, n.id), restore: () => (notes.value = before) })
}
</script>
