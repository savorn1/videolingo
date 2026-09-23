<template>
  <div>
    <PageHeader :title="n?.subject ?? 'Notification'" :crumbs="[{ label: 'Notifications', to: '/notifications' }, { label: `#${route.params.id}` }]">
      <template v-if="n" #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-layers" :to="`/notifications?batchId=${n.batchId}`">Whole send</UButton>
        <UButton v-if="n.channel === 'EMAIL' && n.status === 'FAILED' && canWrite" icon="i-lucide-rotate-cw" :loading="resending" @click="onResend">
          Resend email
        </UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/notifications">Back to notifications</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !n" :fields="6" :lines="false" />

    <div v-else-if="n" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div class="lg:col-span-2 space-y-4">
        <UAlert
          v-if="n.status === 'FAILED'"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          title="Delivery failed"
          :description="n.errorMessage ?? undefined"
        />
        <UAlert
          v-else-if="n.status === 'PENDING'"
          color="warning"
          variant="subtle"
          icon="i-lucide-clock"
          title="Sending…"
          description="The email is being delivered."
        />

        <UCard>
          <template #header>
            <p class="text-xs text-gray-500">Subject</p>
            <h2 class="font-semibold text-gray-900 dark:text-white break-words">{{ n.subject }}</h2>
          </template>
          <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{{ n.body }}</p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">History</h2>
          </template>
          <ol class="relative border-s border-gray-200 dark:border-gray-800 ms-2 space-y-4">
            <li v-for="e in n.events ?? []" :key="e.id" class="ms-5">
              <span
                class="absolute -start-2 flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white dark:ring-gray-900"
                :class="eventMeta(e.type).dot"
              >
                <UIcon :name="eventMeta(e.type).icon" class="w-2.5 h-2.5 text-white" />
              </span>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ eventMeta(e.type).label }}
                <span class="font-normal text-gray-500" :title="formatDateTime(e.createdAt)">· {{ formatRelativeTime(e.createdAt) }}</span>
                <span v-if="e.actor" class="font-normal text-gray-500"> · {{ e.actor }}</span>
              </p>
              <p v-if="e.detail" class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">{{ e.detail }}</p>
            </li>
          </ol>
          <p v-if="!n.events?.length" class="text-sm text-gray-500">No events recorded.</p>
        </UCard>
      </div>

      <UCard>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Recipient</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">
              <NuxtLink v-if="n.recipientId" :to="`/users/${n.recipientId}`" class="hover:underline"><UserChip :name="n.recipientUsername" /></NuxtLink>
              <UserChip v-else :name="n.recipientUsername" />
            </dd>
          </div>
          <div v-if="n.channel === 'EMAIL'">
            <dt class="text-gray-500 dark:text-gray-400">Email address</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">{{ n.recipientEmail ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Channel</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">
              <UBadge color="neutral" variant="subtle" :icon="channelMeta(n.channel).icon">{{ channelMeta(n.channel).label }}</UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Status</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">
              <UBadge :color="notificationStatusMeta(n.status).color" variant="subtle" :icon="notificationStatusMeta(n.status).icon">
                {{ notificationStatusMeta(n.status).label }}
              </UBadge>
            </dd>
          </div>
          <div v-if="n.channel === 'IN_APP'">
            <dt class="text-gray-500 dark:text-gray-400">Read</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">{{ n.readAt ? formatDateTime(n.readAt) : 'Not yet' }}</dd>
          </div>
          <div v-if="n.channel === 'EMAIL'">
            <dt class="text-gray-500 dark:text-gray-400">Attempts</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">{{ n.attempts }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Template</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">
              <NuxtLink
                v-if="n.templateCode"
                :to="`/notifications/templates?q=${n.templateCode}`"
                class="font-mono text-primary-600 dark:text-primary-400 hover:underline"
              >
                {{ n.templateCode }}
              </NuxtLink>
              <span v-else class="text-gray-500">None (written directly)</span>
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Sent by</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">{{ n.sentBy ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Created</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">{{ formatDateTime(n.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Delivered</dt>
            <dd class="mt-0.5 text-gray-900 dark:text-white">{{ n.sentAt ? formatDateTime(n.sentAt) : '—' }}</dd>
          </div>
        </dl>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AppNotification, NotificationEvent } from '~/composables/useNotifications'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const notifications = useNotifications()
const toast = useToast()
const { can } = useAuth()
const canWrite = computed(() => can('notifications', 'WRITE'))

const n = ref<AppNotification | null>(null)
const loading = ref(true)
const error = ref('')
const resending = ref(false)

const EVENT_META: Record<NotificationEvent['type'], { label: string; icon: string; dot: string }> = {
  CREATED: { label: 'Queued', icon: 'i-lucide-clock', dot: 'bg-gray-400' },
  SENT: { label: 'Delivered', icon: 'i-lucide-check', dot: 'bg-success-500' },
  FAILED: { label: 'Failed', icon: 'i-lucide-x', dot: 'bg-error-500' },
  RETRIED: { label: 'Resend requested', icon: 'i-lucide-rotate-cw', dot: 'bg-warning-500' },
  READ: { label: 'Read', icon: 'i-lucide-eye', dot: 'bg-primary-500' }
}
function eventMeta(type: NotificationEvent['type']) {
  return EVENT_META[type] ?? EVENT_META.CREATED
}

let pollTimer: ReturnType<typeof setTimeout> | undefined
async function load() {
  error.value = ''
  try {
    n.value = await notifications.get(Number(route.params.id))
    // Follow a pending email until it settles.
    clearTimeout(pollTimer)
    if (n.value.status === 'PENDING') pollTimer = setTimeout(load, 2000)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onBeforeUnmount(() => clearTimeout(pollTimer))

async function onResend() {
  if (!n.value) return
  resending.value = true
  try {
    n.value = await notifications.resend(n.value.id)
    toast.add({ title: 'Resending email', color: 'success' })
    pollTimer = setTimeout(load, 1500)
  } catch (err) {
    toast.add({ title: 'Could not resend', description: apiErrorMessage(err), color: 'error' })
  } finally {
    resending.value = false
  }
}

onMounted(load)
</script>
