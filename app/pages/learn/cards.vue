<template>
  <div>
    <PageHeader title="My cards" description="Words and key points you saved, brought back just before you'd forget them.">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-plus" @click="openForm(null)">New card</UButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      <KpiTile label="Total cards" icon="i-lucide-layers" :value="formatCount(stats?.total)" color="primary" :loading="!stats" />
      <KpiTile
        label="Due now"
        icon="i-lucide-brain"
        :value="formatCount(stats?.due)"
        :sublabel="stats && !stats.due ? 'All caught up' : ''"
        color="warning"
        :loading="!stats"
      />
      <KpiTile label="Reviewed this session" icon="i-lucide-circle-check" :value="formatCount(reviewed)" color="success" />
    </div>

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
        <div>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{{ reviewed }} reviewed</span>
            <span>{{ queue.length }} left in this session</span>
          </div>
          <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full rounded-full bg-primary-500 dark:bg-primary-400 transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: `${progress}%` }" />
          </div>
        </div>
        <UCard :ui="{ body: 'p-6 sm:p-8' }" class="cursor-pointer" @click="!revealed && (revealed = true)">
          <div class="text-center space-y-4 min-h-48 flex flex-col justify-center">
            <UBadge class="self-center" color="neutral" variant="subtle" size="sm">{{ sourceLabel(current.source) }}</UBadge>
            <p class="text-2xl font-semibold text-gray-900 dark:text-white whitespace-pre-line">{{ current.front }}</p>
            <p v-if="!revealed" class="text-xs text-gray-400">Click the card or press space to reveal</p>
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
        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="search" placeholder="Search cards" icon="i-lucide-search" class="w-full sm:w-64" />
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter cards">
            <UButton
              v-for="f in LIST_FILTERS"
              :key="f.value"
              size="xs"
              :color="listFilter === f.value ? 'primary' : 'neutral'"
              :variant="listFilter === f.value ? 'soft' : 'ghost'"
              :icon="f.icon"
              :aria-pressed="listFilter === f.value"
              @click="listFilter = f.value"
            >
              {{ f.label }}<span v-if="listCounts[f.value] !== null" class="tabular-nums opacity-70"> {{ listCounts[f.value] }}</span>
            </UButton>
          </div>
        </div>
      </UCard>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <EmptyState
          v-if="!shownCards.length && !listLoading"
          icon="i-lucide-layers"
          title="No cards"
          :description="
            search
              ? 'Nothing matches that search.'
              : listFilter !== 'all'
                ? 'No loaded cards match this filter.'
                : 'Save words from a video’s transcript to start.'
          "
          class="py-10"
        />
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="c in shownCards" :key="c.id" class="group flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div class="shrink-0 mt-0.5 rounded-lg p-2" :class="isDue(c) ? 'bg-warning-50 text-warning-600 dark:bg-warning-950 dark:text-warning-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'">
              <UIcon :name="sourceIcon(c.source)" class="w-4 h-4 block" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p class="font-medium text-gray-900 dark:text-white break-words">{{ c.front }}</p>
                <UBadge color="neutral" variant="subtle" size="sm">{{ sourceLabel(c.source) }}</UBadge>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-line break-words">{{ c.back }}</p>
              <p v-if="c.context" class="text-xs italic text-gray-500 mt-1 line-clamp-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2">“{{ c.context }}”</p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                  :class="isDue(c) ? 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
                >
                  <UIcon :name="isDue(c) ? 'i-lucide-alarm-clock' : 'i-lucide-calendar-clock'" class="w-3 h-3" />
                  {{ isDue(c) ? 'Due now' : `Next ${formatRelativeTime(c.dueAt)}` }}
                </span>
                <span v-if="c.lapses" class="inline-flex items-center gap-1 text-error-600 dark:text-error-400" title="Times you forgot this card">
                  <UIcon name="i-lucide-rotate-ccw" class="w-3 h-3" />
                  Forgotten {{ c.lapses }}×
                </span>
                <NuxtLink
                  v-if="c.videoId"
                  :to="`/learn/watch/${c.videoId}${c.atMs ? `?t=${c.atMs}` : ''}`"
                  class="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <UIcon name="i-lucide-play" class="w-3 h-3" />
                  See in video
                </NuxtLink>
              </div>
            </div>
            <div class="flex shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" aria-label="Edit card" @click="openForm(c)" />
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Delete card" @click="confirmDelete = c" />
            </div>
          </li>
        </ul>
        <div v-if="total > cards.length" class="p-3 text-center">
          <UButton size="sm" color="neutral" variant="soft" :loading="listLoading" @click="loadMore">Load more</UButton>
        </div>
      </UCard>
    </template>

    <ConfirmModal
      :model-value="!!confirmDelete"
      title="Delete card"
      :description="`Delete “${confirmDelete?.front ?? ''}”? Its review history is lost.`"
      confirm-label="Delete"
      color="error"
      @update:model-value="(v) => !v && (confirmDelete = null)"
      @confirm="onConfirmDelete"
    />

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
const { record: recordActivity } = useStudyActivity()

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
// Reviewed cards out of everything seen this session (forgotten cards re-queue, so it can dip).
const progress = computed(() => {
  const totalSeen = reviewed.value + queue.value.length
  return totalSeen ? Math.round((reviewed.value / totalSeen) * 100) : 0
})
function isDue(c: StudyCard) {
  return new Date(c.dueAt) <= new Date()
}
function sourceIcon(source: string | null | undefined) {
  return source === 'KEY_POINT' ? 'i-lucide-lightbulb' : source === 'WORD' ? 'i-lucide-type' : 'i-lucide-square-pen'
}
function sourceLabel(source: string | null | undefined) {
  return source === 'KEY_POINT' ? 'Key point' : source === 'WORD' ? 'Word' : 'Card'
}

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
    recordActivity({ cards: 1 })
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

// Quick filters over the cards already loaded (the server search still applies first).
type ListFilter = 'all' | 'due' | 'forgotten'
const LIST_FILTERS: { value: ListFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'i-lucide-layers' },
  { value: 'due', label: 'Due', icon: 'i-lucide-alarm-clock' },
  { value: 'forgotten', label: 'Forgotten', icon: 'i-lucide-rotate-ccw' }
]
const listFilter = ref<ListFilter>('all')
const shownCards = computed(() =>
  listFilter.value === 'due' ? cards.value.filter(isDue) : listFilter.value === 'forgotten' ? cards.value.filter((c) => c.lapses > 0) : cards.value
)
const listCounts = computed<Record<ListFilter, number | null>>(() => ({
  all: cards.value.length,
  due: cards.value.filter(isDue).length,
  forgotten: cards.value.filter((c) => c.lapses > 0).length
}))

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
const confirmDelete = ref<StudyCard | null>(null)
async function onConfirmDelete() {
  const c = confirmDelete.value
  confirmDelete.value = null
  if (c) await onDelete(c)
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
