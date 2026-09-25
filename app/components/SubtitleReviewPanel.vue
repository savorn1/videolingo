<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-gray-900 dark:text-white">Review</h2>
          <StatusBadge :status="subtitle.reviewStatus" />
        </div>
        <div class="flex items-center gap-2">
          <template v-if="subtitle.reviewStatus === 'DRAFT' || subtitle.reviewStatus === 'CHANGES_REQUESTED'">
            <UButton v-if="canWrite" size="sm" icon="i-lucide-send" :disabled="!subtitle.cueCount || editing" @click="openDecision('submit')">
              {{ subtitle.reviewStatus === 'CHANGES_REQUESTED' ? 'Resubmit for review' : 'Send for review' }}
            </UButton>
          </template>
          <template v-else-if="subtitle.reviewStatus === 'IN_REVIEW' && canApprove">
            <UButton size="sm" color="warning" variant="soft" icon="i-lucide-message-square-warning" :disabled="editing" @click="openDecision('reject')">
              Request changes
            </UButton>
            <UTooltip :text="ownSubmission ? 'Someone other than the submitter has to approve it' : ''" :disabled="!ownSubmission">
              <UButton size="sm" color="success" icon="i-lucide-check" :disabled="ownSubmission || editing" @click="openDecision('approve')">Approve</UButton>
            </UTooltip>
          </template>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-300">{{ statusText }}</p>
      <UAlert
        v-if="subtitle.reviewNote"
        :color="subtitle.reviewStatus === 'CHANGES_REQUESTED' ? 'warning' : 'neutral'"
        variant="subtle"
        icon="i-lucide-quote"
        :title="noteTitle"
        :description="subtitle.reviewNote"
      />

      <!-- Comments -->
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            Comments
            <span class="font-normal text-gray-500">({{ openCount }} open{{ resolvedCount ? `, ${resolvedCount} resolved` : '' }})</span>
          </h3>
          <USwitch v-if="resolvedCount" v-model="showResolved" size="xs" label="Show resolved" />
        </div>

        <p v-if="commentsError" class="text-sm text-error-600 dark:text-error-400">{{ commentsError }}</p>
        <p v-else-if="!visibleComments.length" class="text-sm text-gray-500 dark:text-gray-400">
          {{ comments.length ? 'All comments are resolved.' : 'No comments yet. Pause the video on a cue and leave a note about it.' }}
        </p>
        <ul v-else class="space-y-2 max-h-80 overflow-y-auto pr-1">
          <li
            v-for="c in visibleComments"
            :key="c.id"
            class="rounded-lg border px-3 py-2 text-sm"
            :class="c.resolved ? 'border-gray-100 dark:border-gray-800 opacity-60' : 'border-gray-200 dark:border-gray-700'"
          >
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <UButton
                v-if="c.atMs !== null"
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-play"
                class="font-mono"
                :aria-label="`Play from ${formatTimestamp(c.atMs)}`"
                @click="emit('seek', c.atMs)"
              >
                {{ formatTimestamp(c.atMs) }}
              </UButton>
              <UBadge v-else size="sm" color="neutral" variant="subtle">Whole track</UBadge>
              <span class="font-medium text-gray-700 dark:text-gray-200">{{ c.author }}</span>
              <span :title="formatDateTime(c.createdAt)">{{ formatRelativeTime(c.createdAt) }}</span>
              <div class="ml-auto flex items-center gap-0.5">
                <UButton
                  v-if="canWrite"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :icon="c.resolved ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
                  :aria-label="c.resolved ? 'Reopen' : 'Resolve'"
                  :title="c.resolved ? `Resolved by ${c.resolvedBy} — reopen` : 'Resolve'"
                  @click="onResolve(c)"
                />
                <UButton
                  v-if="isAdmin || c.author === username"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Delete comment"
                  @click="onDeleteComment(c)"
                />
              </div>
            </div>
            <p v-if="c.cueText" class="mt-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2 text-xs italic text-gray-500 whitespace-pre-line line-clamp-2">
              {{ c.cueText }}
            </p>
            <p class="mt-1 text-gray-900 dark:text-white whitespace-pre-line">{{ c.body }}</p>
          </li>
        </ul>

        <form v-if="canWrite" class="mt-3 space-y-2" @submit.prevent="onAddComment">
          <UTextarea v-model="newComment" :rows="2" autoresize :maxrows="6" maxlength="2000" placeholder="Leave a comment…" class="w-full" />
          <div class="flex items-center justify-between gap-2">
            <UCheckbox v-model="atCurrentTime" :label="`About the cue at ${formatTimestamp(currentMs)}`" />
            <UButton type="submit" size="sm" icon="i-lucide-message-square-plus" :loading="posting" :disabled="!newComment.trim()">Comment</UButton>
          </div>
        </form>
      </div>
    </div>

    <!-- Submit / approve / request changes -->
    <UModal v-model:open="showDecision" :title="decisionTitle" :ui="{ content: 'sm:max-w-md' }">
      <template #body>
        <form class="space-y-4" @submit.prevent="onDecide">
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ decisionHelp }}</p>
          <UFormField :label="decision === 'reject' ? 'What needs to change?' : 'Note'" :required="decision === 'reject'" :hint="decision === 'reject' ? undefined : 'optional'">
            <UTextarea v-model="decisionNote" :rows="3" maxlength="1000" class="w-full" autofocus />
          </UFormField>
          <UAlert
            v-if="decision === 'approve' && openCount"
            color="warning"
            variant="subtle"
            icon="i-lucide-message-square-warning"
            :title="`${openCount} comment(s) still open`"
            description="You can approve anyway — they stay on the track."
          />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showDecision = false">Cancel</UButton>
            <UButton type="submit" :color="decision === 'reject' ? 'warning' : decision === 'approve' ? 'success' : 'primary'" :loading="deciding" :disabled="decision === 'reject' && !decisionNote.trim()">
              {{ decisionTitle }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import type { Subtitle, SubtitleComment } from '~/composables/useSubtitles'

const props = defineProps<{
  subtitle: Subtitle
  /** Player time, for anchoring new comments. */
  currentMs: number
  /** The page is in edit mode — decisions wait until it's saved. */
  editing?: boolean
}>()
const emit = defineEmits<{ 'update:subtitle': [Subtitle]; seek: [number] }>()
/** Shared with the page, which marks commented cues. */
const comments = defineModel<SubtitleComment[]>('comments', { default: () => [] })

const { submitForReview, approve, requestChanges, comments: listComments, addComment, resolveComment, removeComment } = useSubtitles()
const { can, isAdmin, username } = useAuth()
const toast = useToast()

const canWrite = computed(() => can('subtitles', 'WRITE'))
const canApprove = computed(() => can('subtitles', 'APPROVE'))
const ownSubmission = computed(() => !isAdmin.value && props.subtitle.reviewRequestedBy === username.value)

const statusText = computed(() => {
  const s = props.subtitle
  const when = (at: string | null) => (at ? formatRelativeTime(at) : '')
  switch (s.reviewStatus) {
    case 'IN_REVIEW':
      return `Sent for review by ${s.reviewRequestedBy ?? 'someone'} ${when(s.reviewRequestedAt)}. A reviewer can approve it or ask for changes.`
    case 'APPROVED':
      return `Approved by ${s.reviewedBy ?? 'a reviewer'} ${when(s.reviewedAt)}. Changing its cues or rules sends it back to draft.`
    case 'CHANGES_REQUESTED':
      return `${s.reviewedBy ?? 'A reviewer'} asked for changes ${when(s.reviewedAt)}. Edit the track, then resubmit it.`
    default:
      return 'Not reviewed yet. Send it for review when it’s ready.'
  }
})
const noteTitle = computed(() =>
  props.subtitle.reviewStatus === 'IN_REVIEW' ? `Note from ${props.subtitle.reviewRequestedBy ?? 'the submitter'}` : `Note from ${props.subtitle.reviewedBy ?? 'the reviewer'}`
)

// ── Comments ───────────────────────────────────────────────────────────────
const commentsError = ref('')
const showResolved = ref(false)
const openCount = computed(() => comments.value.filter((c) => !c.resolved).length)
const resolvedCount = computed(() => comments.value.length - openCount.value)
const visibleComments = computed(() =>
  [...comments.value]
    .filter((c) => showResolved.value || !c.resolved)
    .sort((a, b) => (a.atMs ?? -1) - (b.atMs ?? -1) || a.createdAt.localeCompare(b.createdAt))
)

async function loadComments() {
  commentsError.value = ''
  try {
    comments.value = await listComments(props.subtitle.id)
  } catch (err) {
    commentsError.value = apiErrorMessage(err)
  }
}

const newComment = ref('')
const atCurrentTime = ref(true)
const posting = ref(false)
async function onAddComment() {
  if (!newComment.value.trim()) return
  posting.value = true
  try {
    const added = await addComment(props.subtitle.id, newComment.value.trim(), atCurrentTime.value ? props.currentMs : null)
    comments.value = [...comments.value, added]
    newComment.value = ''
  } catch (err) {
    toast.add({ title: 'Could not add comment', description: apiErrorMessage(err), color: 'error' })
  } finally {
    posting.value = false
  }
}

async function onResolve(c: SubtitleComment) {
  try {
    const updated = await resolveComment(props.subtitle.id, c.id, !c.resolved)
    comments.value = comments.value.map((x) => (x.id === c.id ? updated : x))
  } catch (err) {
    toast.add({ title: 'Could not update comment', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteComment(c: SubtitleComment) {
  try {
    await removeComment(props.subtitle.id, c.id)
    comments.value = comments.value.filter((x) => x.id !== c.id)
  } catch (err) {
    toast.add({ title: 'Could not delete comment', description: apiErrorMessage(err), color: 'error' })
  }
}

// ── Decisions ──────────────────────────────────────────────────────────────
type Decision = 'submit' | 'approve' | 'reject'
const showDecision = ref(false)
const decision = ref<Decision>('submit')
const decisionNote = ref('')
const deciding = ref(false)
const decisionTitle = computed(() => ({ submit: 'Send for review', approve: 'Approve', reject: 'Request changes' })[decision.value])
const decisionHelp = computed(
  () =>
    ({
      submit: 'Admins are notified. While it’s in review you can keep fixing things; reviewers see the latest version.',
      approve: `${props.subtitle.reviewRequestedBy ?? 'The submitter'} is notified. If the track is edited later it goes back to draft.`,
      reject: `${props.subtitle.reviewRequestedBy ?? 'The submitter'} is notified with your note.`
    })[decision.value]
)

function openDecision(d: Decision) {
  decision.value = d
  decisionNote.value = ''
  showDecision.value = true
}

async function onDecide() {
  deciding.value = true
  try {
    const note = decisionNote.value.trim() || undefined
    const id = props.subtitle.id
    const updated =
      decision.value === 'submit' ? await submitForReview(id, note) : decision.value === 'approve' ? await approve(id, note) : await requestChanges(id, note!)
    emit('update:subtitle', updated)
    showDecision.value = false
    toast.add({ title: { submit: 'Sent for review', approve: 'Approved', reject: 'Changes requested' }[decision.value], color: 'success' })
  } catch (err) {
    toast.add({ title: `Could not ${decisionTitle.value.toLowerCase()}`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    deciding.value = false
  }
}

watch(() => props.subtitle.id, loadComments, { immediate: true })
</script>
