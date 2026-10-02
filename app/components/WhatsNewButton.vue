<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-sparkles"
      class="relative text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
      aria-label="What's new"
    >
      <span v-if="hasUnseen" class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary-500" aria-hidden="true" />
    </UButton>

    <template #content>
      <div class="w-[24rem] max-w-[calc(100vw-2rem)]">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800">
          <p class="font-semibold text-sm text-gray-900 dark:text-white">What's new</p>
        </div>
        <ul class="max-h-[26rem] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="e in CHANGELOG" :key="e.id" class="px-3 py-2.5">
            <div class="flex items-center gap-2">
              <UBadge :color="areaColor(e.area)" variant="subtle" size="sm">{{ e.area }}</UBadge>
              <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ formatDate(e.date) }}</span>
            </div>
            <p class="text-sm font-medium text-gray-900 dark:text-white mt-1">{{ e.title }}</p>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ e.description }}</p>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
// What's shipped recently — a hand-maintained list (shared/utils/changelog.ts),
// not tied to any backend. "Seen up to" is kept in this browser only, same
// spirit as InboxBell's unread count but with nothing to sync across devices.
import { CHANGELOG, LATEST_CHANGELOG_ID } from '#shared/utils/changelog'

const STORAGE_KEY = 'videolingo:changelog-seen'
const open = ref(false)
const seenId = ref<string | null>(null)

function readSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
onMounted(() => (seenId.value = readSeen()))

const hasUnseen = computed(() => !!LATEST_CHANGELOG_ID && seenId.value !== LATEST_CHANGELOG_ID)

watch(open, (value) => {
  if (!value || !LATEST_CHANGELOG_ID) return
  seenId.value = LATEST_CHANGELOG_ID
  try {
    localStorage.setItem(STORAGE_KEY, LATEST_CHANGELOG_ID)
  } catch {
    // Private mode / storage full: the dot just reappears next visit.
  }
})

function areaColor(area: string) {
  return area === 'Editor' ? 'primary' : area === 'Learning' ? 'success' : 'neutral'
}
function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>
