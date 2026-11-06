<template>
  <div>
    <PageHeader
      title="Comments"
      description="What viewers write under RuengFlix episodes. Five reports hide a comment until you decide; showing it again clears its reports. Pin one comment per episode to keep it on top."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Comments' }]"
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UTabs v-model="filter" :items="filterItems" :content="false" size="sm" />
      </div>

      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #body-data="{ row }">
          <p class="whitespace-pre-line break-words max-w-xl" :class="row.hiddenAt ? 'text-muted line-through' : 'text-highlighted'">{{ row.body }}</p>
          <div v-if="row.replyBody" class="mt-2 ml-3 pl-3 border-l-2 border-primary max-w-xl">
            <p class="text-xs text-muted">
              <UIcon name="i-lucide-badge-check" class="size-3 align-[-1px] text-primary" /> RuengFlix reply by {{ row.replyBy }}
            </p>
            <p class="whitespace-pre-line break-words text-sm">{{ row.replyBody }}</p>
          </div>
          <p class="text-xs text-muted mt-1">
            <UBadge v-if="row.pinnedAt" color="primary" variant="subtle" size="sm" icon="i-lucide-pin" class="mr-1">Pinned</UBadge>
            <span v-if="row.likeCount" class="mr-1"><UIcon name="i-lucide-heart" class="size-3 align-[-1px]" /> {{ row.likeCount }} ·</span>
            {{ row.viewerName }} on
            <NuxtLink :to="`/ruengflix/${row.seriesId}`" class="underline">{{ row.seriesTitle }}</NuxtLink>
            · episode {{ row.episode }}
          </p>
        </template>
        <template #reportCount-data="{ row }">
          <UBadge v-if="row.reportCount" color="warning" variant="subtle">{{ row.reportCount }} report{{ row.reportCount === 1 ? '' : 's' }}</UBadge>
          <p v-if="row.hiddenAt" class="text-xs text-muted mt-1">Hidden {{ row.hiddenBy === 'reports' ? 'by reports' : `by ${row.hiddenBy}` }}</p>
        </template>
        <template #createdAt-data="{ row }">
          <span :title="formatDateTime(row.createdAt)">{{ formatRelativeTime(row.createdAt) }}</span>
        </template>
        <template #actions-data="{ row }">
          <div v-if="canWrite" class="flex gap-1 justify-end">
            <UButton
              v-if="!row.hiddenAt"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-reply"
              :disabled="busyId === row.id"
              @click="openReply(row)"
              >{{ row.replyBody ? 'Edit reply' : 'Reply' }}</UButton
            >
            <UButton
              v-if="!row.hiddenAt"
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="row.pinnedAt ? 'i-lucide-pin-off' : 'i-lucide-pin'"
              :loading="busyId === row.id && busyAction === 'pin'"
              :disabled="busyId === row.id"
              @click="setPinned(row, !row.pinnedAt)"
              >{{ row.pinnedAt ? 'Unpin' : 'Pin' }}</UButton
            >
            <UButton
              v-if="!row.hiddenAt"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-eye-off"
              :loading="busyId === row.id && busyAction === 'hide'"
              :disabled="busyId === row.id"
              @click="setHidden(row, true)"
              >Hide</UButton
            >
            <UButton
              v-else
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-eye"
              :loading="busyId === row.id && busyAction === 'hide'"
              @click="setHidden(row, false)"
              >Show</UButton
            >
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-message-square"
            :title="
              filter === 'reported'
                ? 'Nothing reported'
                : filter === 'hidden'
                  ? 'No hidden comments'
                  : filter === 'pinned'
                    ? 'No pinned comments'
                    : 'No comments yet'
            "
            description="Signed-in viewers comment under each episode on RuengFlix."
          />
        </template>
      </DataTable>
      <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </UCard>

    <UModal :open="replying !== null" title="Reply as RuengFlix" @update:open="(v: boolean) => !v && !replyBusy && (replying = null)">
      <template #body>
        <div v-if="replying" class="space-y-3">
          <blockquote class="text-sm text-muted border-l-2 border-default pl-3 whitespace-pre-line">{{ replying.viewerName }}: {{ replying.body }}</blockquote>
          <UFormField
            label="Reply"
            :hint="`${replyText.length}/500`"
            description="Shown under the comment with an official RuengFlix badge. Writing again replaces it."
          >
            <UTextarea v-model="replyText" :maxlength="500" :rows="4" autofocus class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between gap-2 w-full">
          <UButton v-if="replying?.replyBody" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="replyBusy" @click="removeReply"
            >Remove reply</UButton
          >
          <span v-else />
          <div class="flex gap-2">
            <UButton color="neutral" variant="ghost" :disabled="replyBusy" @click="replying = null">Cancel</UButton>
            <UButton icon="i-lucide-send" :loading="replyBusy" :disabled="!replyText.trim()" @click="sendReply">Post reply</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { CommentFilter, StreamingComment } from '~/composables/useStreaming'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<StreamingComment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const filter = ref<CommentFilter>('reported')
const loading = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)
const busyAction = ref<'hide' | 'pin' | null>(null)

const filterItems = [
  { label: 'Reported', value: 'reported' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Pinned', value: 'pinned' },
  { label: 'All', value: 'all' }
]

const columns: ColumnDef<StreamingComment>[] = [
  { key: 'body', label: 'Comment', value: (r) => r.body },
  { key: 'reportCount', label: 'Reports', value: (r) => String(r.reportCount) },
  { key: 'createdAt', label: 'Posted' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await streaming.comments({ filter: filter.value, page: page.value, size: pageSize.value })
    rows.value = res.items
    total.value = res.total
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function setHidden(row: StreamingComment, hidden: boolean) {
  busyId.value = row.id
  busyAction.value = 'hide'
  try {
    await streaming.setCommentHidden(row.id, hidden)
    toast.add({ title: hidden ? 'Comment hidden from RuengFlix' : 'Comment shown again', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update the comment', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
    busyAction.value = null
  }
}

const replying = ref<StreamingComment | null>(null)
const replyText = ref('')
const replyBusy = ref(false)

function openReply(row: StreamingComment) {
  replying.value = row
  replyText.value = row.replyBody ?? ''
}

async function sendReply() {
  const row = replying.value
  if (!row) return
  replyBusy.value = true
  try {
    await streaming.replyToComment(row.id, replyText.value.trim())
    toast.add({ title: 'Reply posted on RuengFlix', color: 'success' })
    replying.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not post the reply', description: apiErrorMessage(err), color: 'error' })
  } finally {
    replyBusy.value = false
  }
}

async function removeReply() {
  const row = replying.value
  if (!row) return
  replyBusy.value = true
  try {
    await streaming.deleteReply(row.id)
    toast.add({ title: 'Reply removed', color: 'success' })
    replying.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not remove the reply', description: apiErrorMessage(err), color: 'error' })
  } finally {
    replyBusy.value = false
  }
}

/** Pinning replaces the comment pinned on that episode before */
async function setPinned(row: StreamingComment, pinned: boolean) {
  busyId.value = row.id
  busyAction.value = 'pin'
  try {
    await streaming.setCommentPinned(row.id, pinned)
    toast.add({ title: pinned ? `Pinned on episode ${row.episode} of ${row.seriesTitle}` : 'Comment unpinned', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update the comment', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
    busyAction.value = null
  }
}

watch(filter, () => {
  page.value = 1
  load()
})
watch([page, pageSize], load)
onMounted(load)
</script>
