<template>
  <div>
    <PageHeader
      title="Send notification"
      description="Message users in the app, by email, or both."
      :crumbs="[{ label: 'Notifications', to: '/notifications' }, { label: 'Send' }]"
    />

    <UAlert
      v-if="status && !status.emailConfigured && form.channels.includes('EMAIL')"
      color="warning"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-mail-warning"
      title="Email isn't configured on the server"
      description="Email copies will be recorded as failed until MAIL_HOST is set — you can resend them afterwards. In-app delivery works."
    />

    <div class="grid grid-cols-1 xl:grid-cols-[1fr_26rem] gap-4 items-start">
      <div class="space-y-4">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">Message</h2>
          </template>
          <div class="space-y-4">
            <UFormField label="Template" description="Optional — fills in the subject, message and channels">
              <div class="flex gap-2">
                <USelectMenu
                  v-model="form.templateId"
                  :items="templateOptions"
                  value-key="value"
                  placeholder="Write from scratch"
                  :search-input="{ placeholder: 'Search templates…' }"
                  aria-label="Template"
                  class="w-full sm:w-80"
                />
                <UButton v-if="edited && selectedTemplate" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="applyTemplate(selectedTemplate)">
                  Reset text
                </UButton>
              </div>
            </UFormField>

            <UFormField label="Subject" required :hint="`${form.subject.length}/200`">
              <UInput v-model="form.subject" maxlength="200" class="w-full" placeholder="What's this about?" />
            </UFormField>
            <UFormField label="Message" required :hint="`${form.body.length}/10000`">
              <UTextarea v-model="form.body" :rows="8" autoresize :maxrows="18" maxlength="10000" class="w-full" />
            </UFormField>
            <p class="text-xs text-gray-500">
              Placeholders filled per recipient:
              <code v-for="v in BUILT_IN_VARIABLES" :key="v.name" class="mr-1.5" :title="v.description">&#123;&#123;{{ v.name }}&#125;&#125;</code>
            </p>

            <div v-if="custom.length" class="rounded-md border border-primary-200 dark:border-primary-900 p-3 space-y-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Fill in the placeholders</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UFormField v-for="v in custom" :key="v" :label="v" required>
                  <UInput v-model="form.variables[v]" maxlength="1000" class="w-full" :placeholder="`Value for {{${v}}}`" />
                </UFormField>
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">Delivery</h2>
          </template>
          <div class="space-y-5">
            <UFormField label="Channels" required>
              <UCheckboxGroup v-model="form.channels" :items="channelItems" orientation="horizontal" :ui="{ fieldset: 'gap-x-6 gap-y-2 flex-wrap' }" />
            </UFormField>

            <UFormField label="Recipients" required>
              <URadioGroup v-model="form.audience" :items="audienceOptions" orientation="horizontal" class="mb-3" />
              <USelectMenu
                v-if="form.audience === 'users'"
                v-model="form.userIds"
                :items="userOptions"
                value-key="value"
                multiple
                placeholder="Choose users"
                :search-input="{ placeholder: 'Search users…' }"
                :loading="usersLoading"
                aria-label="Recipients"
                class="w-full"
              />
              <USelect v-else-if="form.audience === 'role'" v-model="form.role" :items="roleOptions" class="w-48" aria-label="Role" />
              <p v-else class="text-sm text-gray-500">Every enabled account.</p>
            </UFormField>
          </div>
        </UCard>
      </div>

      <!-- Preview -->
      <UCard class="xl:sticky xl:top-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-gray-900 dark:text-white">Preview</h2>
            <UIcon v-if="previewing" name="i-lucide-loader-circle" class="w-4 h-4 animate-spin text-gray-400" />
          </div>
        </template>
        <div class="space-y-4">
          <div v-if="preview" class="rounded-md border border-gray-200 dark:border-gray-800 p-3">
            <p class="text-xs text-gray-500 mb-1">
              As {{ preview.sampleRecipient ?? 'a recipient' }} will see it
              <template v-if="!preview.recipientCount"> (you — nobody selected yet)</template>
            </p>
            <p class="font-semibold text-gray-900 dark:text-white break-words">{{ preview.subject || '(no subject)' }}</p>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{{ preview.body || '(no message)' }}</p>
          </div>
          <p v-else-if="previewError" class="text-sm text-error-600">{{ previewError }}</p>
          <USkeleton v-else class="h-32" />

          <ul v-if="preview" class="space-y-1.5 text-sm">
            <li class="flex items-center gap-2">
              <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
              <strong>{{ preview.recipientCount }}</strong> recipient{{ preview.recipientCount === 1 ? '' : 's' }}
              <span v-if="form.channels.length" class="text-gray-500">× {{ form.channels.length }} channel{{ form.channels.length === 1 ? '' : 's' }}</span>
            </li>
            <li v-if="preview.disabledSkipped" class="flex items-center gap-2 text-warning-700 dark:text-warning-400">
              <UIcon name="i-lucide-user-x" class="w-4 h-4" /> {{ preview.disabledSkipped }} disabled account(s) will be skipped
            </li>
            <li v-if="preview.recipientsWithoutEmail" class="flex items-center gap-2 text-warning-700 dark:text-warning-400">
              <UIcon name="i-lucide-mail-x" class="w-4 h-4" /> {{ preview.recipientsWithoutEmail }} recipient(s) have no email — their email copy will fail
            </li>
            <li v-if="preview.missingVariables.length" class="flex items-center gap-2 text-error-700 dark:text-error-400">
              <UIcon name="i-lucide-braces" class="w-4 h-4" /> Missing: {{ preview.missingVariables.join(', ') }}
            </li>
          </ul>

          <UAlert v-if="blocker && touched" color="neutral" variant="subtle" icon="i-lucide-info" :title="blocker" />
          <UButton block size="lg" icon="i-lucide-send" :disabled="!!blocker || !canWrite" @click="confirmOpen = true">
            {{ preview?.recipientCount ? `Send to ${preview.recipientCount} user${preview.recipientCount === 1 ? '' : 's'}` : 'Send' }}
          </UButton>
        </div>
      </UCard>
    </div>

    <ConfirmModal
      v-model="confirmOpen"
      title="Send this notification?"
      :description="confirmText"
      confirm-label="Send now"
      :loading="sending"
      @confirm="onSend"
    />
  </div>
</template>

<script setup lang="ts">
import type { NotificationChannel } from '#shared/utils/notifications'
import type { NotificationPreview, NotificationServiceStatus, NotificationTemplate, SendNotificationPayload } from '~/composables/useNotifications'
import type { AdminUser, Role } from '~/composables/useUsers'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const notifications = useNotifications()
const { list: listUsers } = useUsers()
const toast = useToast()

const channelItems = NOTIFICATION_CHANNELS.map((c) => ({ label: c.label, description: c.description, value: c.value }))
const { can } = useAuth()
const canWrite = computed(() => can('notifications', 'WRITE'))

type Audience = 'users' | 'role' | 'all'
const form = reactive({
  templateId: undefined as number | undefined,
  subject: '',
  body: '',
  channels: ['IN_APP'] as NotificationChannel[],
  audience: 'users' as Audience,
  userIds: [] as number[],
  role: 'USER' as Role,
  variables: {} as Record<string, string>
})

const templatesList = ref<NotificationTemplate[]>([])
const users = ref<AdminUser[]>([])
const usersLoading = ref(true)
const status = ref<NotificationServiceStatus | null>(null)

const audienceOptions = [
  { label: 'Selected users', value: 'users' },
  { label: 'By role', value: 'role' },
  { label: 'Everyone', value: 'all' }
]
const roleOptions = [
  { label: 'All admins', value: 'ADMIN' },
  { label: 'All users (role USER)', value: 'USER' }
]
const templateOptions = computed(() => [
  { label: 'Write from scratch', value: undefined },
  ...templatesList.value.map((t) => ({ label: t.name, value: t.id, description: t.code }))
])
const userOptions = computed(() =>
  users.value.map((u) => ({
    label: u.username,
    value: u.id,
    description: [u.email ?? 'no email', u.enabled ? null : 'disabled'].filter(Boolean).join(' · ')
  }))
)
const selectedTemplate = computed(() => templatesList.value.find((t) => t.id === form.templateId) ?? null)
const edited = computed(() => !!selectedTemplate.value && (form.subject !== selectedTemplate.value.subject || form.body !== selectedTemplate.value.body))
const custom = computed(() => customVariables(form.subject, form.body))

function applyTemplate(t: NotificationTemplate) {
  form.subject = t.subject
  form.body = t.body
  form.channels = [...t.defaultChannels]
}
watch(
  () => form.templateId,
  () => {
    if (selectedTemplate.value) applyTemplate(selectedTemplate.value)
  }
)

function payload(): SendNotificationPayload {
  const variables: Record<string, string> = {}
  for (const name of custom.value) {
    if (form.variables[name]?.trim()) variables[name] = form.variables[name]!
  }
  return {
    templateId: form.templateId,
    subject: form.subject,
    body: form.body,
    channels: form.channels,
    userIds: form.audience === 'users' ? form.userIds : undefined,
    role: form.audience === 'role' ? form.role : undefined,
    allUsers: form.audience === 'all',
    variables
  }
}

// ── live preview ────────────────────────────────────────────────────────
const preview = ref<NotificationPreview | null>(null)
const previewing = ref(false)
const previewError = ref('')
const touched = ref(false)
let previewTimer: ReturnType<typeof setTimeout> | undefined
let previewSeq = 0

async function refreshPreview() {
  if (!form.channels.length) return
  const seq = ++previewSeq
  previewing.value = true
  try {
    const result = await notifications.preview(payload())
    if (seq !== previewSeq) return
    preview.value = result
    previewError.value = ''
  } catch (err) {
    if (seq === previewSeq) previewError.value = apiErrorMessage(err)
  } finally {
    if (seq === previewSeq) previewing.value = false
  }
}
watch(
  () => JSON.stringify(payload()),
  () => {
    touched.value = true
    clearTimeout(previewTimer)
    previewTimer = setTimeout(refreshPreview, 350)
  }
)

// First reason sending isn't possible yet, if any.
const blocker = computed(() => {
  if (!form.subject.trim() || !form.body.trim()) return 'Write a subject and message.'
  if (!form.channels.length) return 'Pick at least one channel.'
  if (form.audience === 'users' && !form.userIds.length) return 'Choose who receives it.'
  if (preview.value && !preview.value.recipientCount) return 'Nobody would receive this — every selected account is disabled.'
  const missing = custom.value.filter((v) => !form.variables[v]?.trim())
  if (missing.length) return `Fill in: ${missing.join(', ')}.`
  return ''
})

const confirmText = computed(() => {
  const n = preview.value?.recipientCount ?? 0
  const via = form.channels.map((c) => channelMeta(c).label.toLowerCase()).join(' and ')
  return `“${preview.value?.subject ?? form.subject}” goes to ${n} user${n === 1 ? '' : 's'} by ${via}. This can't be undone.`
})

// ── send ────────────────────────────────────────────────────────────────
const confirmOpen = ref(false)
const sending = ref(false)
async function onSend() {
  sending.value = true
  try {
    const batch = await notifications.send(payload())
    confirmOpen.value = false
    toast.add({
      title: `Sent to ${batch.recipientCount} user${batch.recipientCount === 1 ? '' : 's'}`,
      description: batch.pending ? 'Emails are being delivered.' : undefined,
      color: 'success'
    })
    await navigateTo(`/notifications?batchId=${batch.id}`)
  } catch (err) {
    toast.add({ title: 'Not sent', description: apiErrorMessage(err), color: 'error' })
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  const [t, s] = await Promise.allSettled([notifications.templates({ size: 100, sortBy: 'name', sortOrder: 'asc' }), notifications.status()])
  if (t.status === 'fulfilled') templatesList.value = t.value.data
  if (s.status === 'fulfilled') status.value = s.value
  const fromQuery = Number(route.query.templateId)
  if (fromQuery && templatesList.value.some((x) => x.id === fromQuery)) form.templateId = fromQuery
  const userFromQuery = Number(route.query.userId)
  try {
    users.value = (await listUsers({ size: 500, sortBy: 'username', sortOrder: 'asc' })).data
  } catch {
    users.value = []
  } finally {
    usersLoading.value = false
  }
  if (userFromQuery && users.value.some((u) => u.id === userFromQuery)) form.userIds = [userFromQuery]
  await refreshPreview()
  touched.value = false
})
</script>
