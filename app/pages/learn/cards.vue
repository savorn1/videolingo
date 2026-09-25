<template>
  <div>
    <PageHeader title="My cards" description="Words and key points you saved, brought back just before you'd forget them.">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-plus" @click="openForm(null)">New card</UButton>
      </template>
    </PageHeader>

    <UTabs v-model="tab" :items="tabItems" :content="false" class="mb-4" />

    <!-- ── Review ─────────────────────────────────────────────────────────── -->
    <template v-if="tab === 'review'">
      <div v-if="reviewLoading" class="max-w-xl mx-auto"><USkeleton class="h-64 rounded-xl" /></div>
      <EmptyState
        v-else-if="!current"
        icon="i-lucide-party-popper"
        :title="reviewed ? `Done — ${reviewed} card${reviewed === 1 ? '' : 's'} reviewed` : 'Nothing to review right now'"
        :description="
          stats?.total
            ? 'Come back later: cards return when they are due.'
            : 'Click words in a video’s transcript to save them here, or add key points from its study tab.'
        "
      >
        <template #action>
          <UButton icon="i-lucide-clapperboard" to="/learn">Find something to watch</UButton>
        </template>
      </EmptyState>
      <div v-else class="max-w-xl mx-auto space-y-4">
        <p class="text-center text-sm text-gray-500">{{ queue.length }} left in this session</p>
        <UCard :ui="{ body: 'p-6 sm:p-8' }">
          <div class="text-center space-y-4 min-h-40 flex flex-col justify-center">
            <p class="text-2xl font-semibold text-gray-900 dark:text-white whitespace-pre-line">{{ current.front }}</p>
            <template v-if="revealed">
              <USeparator />
              <p class="text-lg text-gray-800 dark:text-gray-200 whitespace-pre-line">{{ current.back }}</p>
              <p v-if="current.context" class="text-sm italic text-gray-500 whitespace-pre-line">“{{ current.context }}”</p>
              <UButton
                v-if="current.videoId"
                size="xs"
                variant="link"
                icon="i-lucide-play"
                :to="`/learn/watch/${current.videoId}${current.atMs ? `?t=${current.atMs}` : ''}`"
                class="self-center"
              >
                See it in the video
              </UButton>
            </template>
          </div>
        </UCard>
        <div v-if="!revealed" class="flex justify-center">
          <UButton size="lg" icon="i-lucide-eye" @click="revealed = true">Show answer <UKbd value="space" class="ml-1" /></UButton>
        </div>
        <div v-else class="grid grid-cols-4 gap-2">
          <UButton
            v-for="(g, k) in GRADES"
            :key="g.value"
            block
            :color="g.color"
            variant="soft"
            :loading="grading === g.value"
            :disabled="!!grading"
            class="flex-col gap-0.5 py-2"
            @click="grade(g.value)"
          >
            <span class="font-semibold">{{ g.label }}</span>
            <span class="text-xs opacity-75">{{ formatInterval(nextIntervalDays(current, g.value)) }} · {{ k + 1 }}</span>
          </UButton>
        </div>
      </div>
    </template>

    <!-- ── All cards ──────────────────────────────────────────────────────── -->
    <template v-else>
      <UCard class="mb-4">
        <UInput v-model="search" placeholder="Search cards" icon="i-lucide-search" class="w-64" />
      </UCard>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <EmptyState
          v-if="!cards.length && !listLoading"
          icon="i-lucide-layers"
          title="No cards"
          :description="search ? 'Nothing matches that search.' : 'Save words from a video’s transcript to start.'"
          class="py-10"
        />
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="c in cards" :key="c.id" class="flex items-start gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900 dark:text-white">{{ c.front }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-300">{{ c.back }}</p>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ c.source === 'KEY_POINT' ? 'Key point' : c.source === 'WORD' ? 'Word' : 'Card' }}
                · {{ new Date(c.dueAt) <= new Date() ? 'due now' : `next ${formatRelativeTime(c.dueAt)}` }}
                <template v-if="c.lapses"> · forgotten {{ c.lapses }}×</template>
              </p>
            </div>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" aria-label="Edit card" @click="openForm(c)" />
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Delete card" @click="onDelete(c)" />
          </li>
        </ul>
        <div v-if="total > cards.length" class="p-3 text-center">
          <UButton size="sm" color="neutral" variant="soft" :loading="listLoading" @click="loadMore">Load more</UButton>
        </div>
      </UCard>
    </template>

    <UModal v-model:open="showForm" :title="editing ? 'Edit card' : 'New card'" :ui="{ content: 'sm:max-w-md' }">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSave">
          <UFormField label="Front" required hint="the word or question">
            <UInput v-model="form.front" maxlength="300" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Back" required hint="the meaning or answer">
            <UTextarea v-model="form.back" :rows="3" maxlength="1000" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showForm = false">Cancel</UButton>
            <UButton type="submit" :loading="saving" :disabled="!form.front.trim() || !form.back.trim()">Save</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Flashcard review (spaced repetition — graded on the server) and the list of
// every saved card.
import type { CardGrade, StudyCard } from '~/composables/useStudy'

const { due, review, stats: getStats, cards: listCards, create, update, remove } = useStudy()
const toast = useToast()

const stats = ref<{ total: number; due: number } | null>(null)
const tab = ref<'review' | 'all'>('review')
const tabItems = computed(() => [
  { label: `Review${stats.value?.due ? ` (${stats.value.due})` : ''}`, value: 'review', icon: 'i-lucide-brain' },
  { label: `All cards${stats.value ? ` (${stats.value.total})` : ''}`, value: 'all', icon: 'i-lucide-layers' }
])

async function refreshStats() {
  stats.value = await getStats().catch(() => null)
}

// ── Review ─────────────────────────────────────────────────────────────────
const GRADES: { value: CardGrade; label: string; color: 'error' | 'warning' | 'primary' | 'success' }[] = [
  { value: 'AGAIN', label: 'Again', color: 'error' },
  { value: 'HARD', label: 'Hard', color: 'warning' },
  { value: 'GOOD', label: 'Good', color: 'primary' },
  { value: 'EASY', label: 'Easy', color: 'success' }
]
const queue = ref<StudyCard[]>([])
const current = computed(() => queue.value[0] ?? null)
const revealed = ref(false)
const reviewLoading = ref(true)
const reviewed = ref(0)
const grading = ref<CardGrade | null>(null)

async function loadDue() {
  reviewLoading.value = true
  try {
    queue.value = await due(50)
  } catch {
    queue.value = []
  } finally {
    reviewLoading.value = false
  }
}

async function grade(g: CardGrade) {
  const card = current.value
  if (!card || grading.value) return
  grading.value = g
  try {
    const next = await review(card.id, g)
    queue.value.shift()
    // Forgotten cards come back in this same session.
    if (g === 'AGAIN') queue.value.push(next)
    reviewed.value++
    revealed.value = false
    refreshStats()
  } catch (err) {
    toast.add({ title: 'Could not save the review', description: apiErrorMessage(err), color: 'error' })
  } finally {
    grading.value = null
  }
}

defineShortcuts({
  ' ': () => tab.value === 'review' && current.value && !revealed.value && (revealed.value = true),
  '1': () => revealed.value && grade('AGAIN'),
  '2': () => revealed.value && grade('HARD'),
  '3': () => revealed.value && grade('GOOD'),
  '4': () => revealed.value && grade('EASY')
})

// ── All cards ──────────────────────────────────────────────────────────────
const cards = ref<StudyCard[]>([])
const total = ref(0)
const listPage = ref(1)
const listLoading = ref(false)
const search = ref('')

async function loadCards(reset = true) {
  listLoading.value = true
  if (reset) listPage.value = 1
  try {
    const res = await listCards({ search: search.value.trim() || undefined, page: listPage.value, size: 50 })
    cards.value = reset ? res.data : [...cards.value, ...res.data]
    total.value = res.metadata.totalCount
  } catch (err) {
    toast.add({ title: 'Could not load cards', description: apiErrorMessage(err), color: 'error' })
  } finally {
    listLoading.value = false
  }
}
function loadMore() {
  listPage.value++
  loadCards(false)
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => loadCards(), 300)
})
watch(tab, (t) => (t === 'all' ? loadCards() : loadDue()))

const showForm = ref(false)
const editing = ref<StudyCard | null>(null)
const form = reactive({ front: '', back: '' })
const saving = ref(false)
function openForm(c: StudyCard | null) {
  editing.value = c
  Object.assign(form, { front: c?.front ?? '', back: c?.back ?? '' })
  showForm.value = true
}
async function onSave() {
  saving.value = true
  try {
    if (editing.value) await update(editing.value.id, { front: form.front, back: form.back, context: editing.value.context })
    else await create({ front: form.front, back: form.back }, 'MANUAL')
    showForm.value = false
    toast.add({ title: 'Card saved', color: 'success' })
    await Promise.all([loadCards(), refreshStats(), tab.value === 'review' ? loadDue() : Promise.resolve()])
  } catch (err) {
    toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function onDelete(c: StudyCard) {
  try {
    await remove(c.id)
    cards.value = cards.value.filter((x) => x.id !== c.id)
    total.value--
    refreshStats()
  } catch (err) {
    toast.add({ title: 'Could not delete', description: apiErrorMessage(err), color: 'error' })
  }
}

onMounted(() => {
  refreshStats()
  loadDue()
})
</script>
