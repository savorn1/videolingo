<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton color="neutral" variant="ghost" icon="i-lucide-bell" class="relative" :aria-label="unread ? `Notifications, ${unread} unread` : 'Notifications'">
      <span
        v-if="unread"
        class="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-error-500 text-white text-[10px] font-semibold leading-4 text-center tabular-nums"
        aria-hidden="true"
      >
        {{ unread > 99 ? '99+' : unread }}
      </span>
    </UButton>

    <template #content>
      <div class="w-[22rem] max-w-[calc(100vw-2rem)]">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800">
          <p class="font-semibold text-sm text-gray-900 dark:text-white">Notifications</p>
          <div class="flex items-center gap-1">
            <UButton size="xs" :color="unreadOnly ? 'primary' : 'neutral'" variant="ghost" @click="unreadOnly = !unreadOnly">
              {{ unreadOnly ? 'Unread' : 'All' }}
            </UButton>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-check-check" :disabled="!unread" :loading="markingAll" @click="markAll">
              Mark all read
            </UButton>
          </div>
        </div>

        <div class="max-h-[26rem] overflow-y-auto">
          <div v-if="loading && !items.length" class="p-3 space-y-2">
            <USkeleton v-for="i in 3" :key="i" class="h-12" />
          </div>
          <div v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-gray-500">
            <UIcon name="i-lucide-bell-off" class="w-6 h-6 mx-auto mb-2 text-gray-400" />
            {{ unreadOnly ? 'Nothing unread.' : 'No notifications yet.' }}
          </div>
          <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <li v-for="n in items" :key="n.id">
              <button
                type="button"
                class="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex gap-2.5"
                :aria-expanded="expanded === n.id"
                @click="toggle(n)"
              >
                <span
                  class="mt-1.5 w-2 h-2 rounded-full shrink-0"
                  :class="n.readAt ? 'bg-transparent' : 'bg-primary-500'"
                  :aria-label="n.readAt ? undefined : 'Unread'"
                />
                <span class="min-w-0 flex-1">
                  <span
                    class="block text-sm text-gray-900 dark:text-white"
                    :class="[n.readAt ? '' : 'font-semibold', expanded === n.id ? 'break-words' : 'truncate']"
                  >
                    {{ n.subject }}
                  </span>
                  <span
                    class="block text-xs text-gray-600 dark:text-gray-400 mt-0.5"
                    :class="expanded === n.id ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'"
                    >{{ n.body }}</span
                  >
                  <span class="block text-[11px] text-gray-400 mt-1" :title="formatDateTime(n.createdAt)">
                    {{ formatRelativeTime(n.createdAt) }}<template v-if="n.sentBy"> · from {{ n.sentBy }}</template>
                  </span>
                </span>
              </button>
            </li>
          </ul>
          <div v-if="hasMore" class="p-2 border-t border-gray-100 dark:border-gray-800">
            <UButton block size="xs" color="neutral" variant="ghost" :loading="loading" @click="loadMore">Load more</UButton>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import type { AppNotification } from '~/composables/useNotifications'

const inbox = useInbox()
const toast = useToast()

const open = ref(false)
const unread = ref(0)
const unreadOnly = ref(false)
const items = ref<AppNotification[]>([])
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const markingAll = ref(false)
const expanded = ref<number | null>(null)

async function refreshCount() {
  try {
    unread.value = await inbox.unreadCount()
  } catch {
    // Not critical — the badge just stays as it was.
  }
}

async function load(reset = true) {
  loading.value = true
  try {
    if (reset) page.value = 1
    const res = await inbox.list(unreadOnly.value, page.value, 10)
    items.value = reset ? res.data : [...items.value, ...res.data]
    hasMore.value = res.metadata.hasNext
  } catch (err) {
    toast.add({ title: 'Could not load notifications', description: apiErrorMessage(err), color: 'error' })
  } finally {
    loading.value = false
  }
}

function loadMore() {
  page.value++
  load(false)
}

// Opening one shows it in full and marks it read.
async function toggle(n: AppNotification) {
  expanded.value = expanded.value === n.id ? null : n.id
  if (n.readAt) return
  try {
    const updated = await inbox.markRead(n.id)
    items.value = items.value.map((x) => (x.id === n.id ? updated : x))
    unread.value = Math.max(0, unread.value - 1)
  } catch {
    // Leave it unread; the next open retries.
  }
}

async function markAll() {
  markingAll.value = true
  try {
    await inbox.markAllRead()
    const now = new Date().toISOString()
    items.value = unreadOnly.value ? [] : items.value.map((x) => (x.readAt ? x : { ...x, readAt: now }))
    unread.value = 0
  } catch (err) {
    toast.add({ title: 'Could not mark as read', description: apiErrorMessage(err), color: 'error' })
  } finally {
    markingAll.value = false
  }
}

watch(open, (value) => {
  if (value) {
    expanded.value = null
    load()
    refreshCount()
  }
})
watch(unreadOnly, () => load())

// Poll gently; also refresh when the tab regains focus.
let timer: ReturnType<typeof setInterval> | undefined
function onFocus() {
  refreshCount()
}
onMounted(() => {
  refreshCount()
  timer = setInterval(refreshCount, 60_000)
  window.addEventListener('focus', onFocus)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('focus', onFocus)
})
</script>
