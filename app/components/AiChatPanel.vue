<template>
  <div class="grid grid-cols-1 md:grid-cols-[15rem_1fr] gap-4 min-h-[32rem]">
    <!-- Conversations -->
    <UCard :ui="{ body: 'p-2 sm:p-2' }">
      <UButton block icon="i-lucide-plus" :disabled="!canWrite || !!pending" class="mb-2" @click="startNew">New chat</UButton>
      <div v-if="loadingList" class="space-y-2 p-1">
        <USkeleton v-for="i in 3" :key="i" class="h-10" />
      </div>
      <p v-else-if="!chats.length" class="text-xs text-gray-500 p-2">No conversations yet.</p>
      <ul v-else class="space-y-0.5">
        <li v-for="c in chats" :key="c.id" class="group flex items-center gap-1">
          <button
            type="button"
            class="flex-1 min-w-0 text-left rounded-md px-2 py-1.5 text-sm"
            :class="
              c.id === active?.id ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            "
            @click="open(c.id)"
          >
            <span class="block truncate">{{ c.title }}</span>
            <span class="block text-xs text-gray-400"
              >{{ c.messageCount / 2 }} question{{ c.messageCount === 2 ? '' : 's' }} · {{ formatUsd(c.totalCostUsd) }}</span
            >
          </button>
          <UButton
            v-if="canWrite"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            class="opacity-0 group-hover:opacity-100 focus:opacity-100"
            :aria-label="`Delete chat ${c.title}`"
            @click="toDelete = c"
          />
        </li>
      </ul>
    </UCard>

    <!-- Conversation -->
    <UCard :ui="{ root: 'flex flex-col', body: 'flex-1 flex flex-col p-0 sm:p-0 min-h-0' }">
      <div ref="scroller" class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[36rem]">
        <EmptyState
          v-if="!active && !loadingChat && !pending"
          icon="i-lucide-messages-square"
          title="Ask about this video"
          description="Answers are grounded in the transcript — ask what a phrase means, for grammar explanations, or for more examples."
        />
        <div v-else-if="loadingChat" class="space-y-3">
          <USkeleton v-for="i in 3" :key="i" class="h-12" />
        </div>
        <template v-else>
          <p v-if="!messages.length && !pending" class="text-sm text-gray-500 text-center py-8">Ask your first question below.</p>
          <div v-for="m in messages" :key="m.id" class="flex" :class="m.role === 'USER' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%]">
              <div
                class="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words"
                :class="m.role === 'USER' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'"
              >
                {{ m.content }}
              </div>
              <AiUsageLine v-if="m.role === 'ASSISTANT'" :usage="m.usage" class="mt-1" />
            </div>
          </div>
          <template v-if="pending">
            <div class="flex justify-end">
              <div class="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-primary-500/70 text-white">{{ pending }}</div>
            </div>
            <div class="flex justify-start">
              <div class="rounded-lg px-3 py-2 bg-gray-100 dark:bg-gray-800 text-sm text-gray-500 flex items-center gap-2">
                <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" /> Thinking…
              </div>
            </div>
          </template>
        </template>
      </div>

      <form class="border-t border-gray-200 dark:border-gray-800 p-3 flex gap-2 items-end" @submit.prevent="submit">
        <UTextarea
          v-model="draft"
          :rows="2"
          autoresize
          :maxrows="6"
          :maxlength="MAX_CHARS"
          class="flex-1"
          :placeholder="notReadyReason ?? (canWrite ? 'Ask about this video…  (Enter to send, Shift+Enter for a new line)' : 'You have read-only access to AI')"
          :disabled="!canWrite || !!pending || !ready"
          aria-label="Message"
          @keydown.enter.exact.prevent="submit"
        />
        <UButton type="submit" icon="i-lucide-send" :loading="!!pending" :disabled="!canWrite || !draft.trim() || !ready" aria-label="Send" />
      </form>
    </UCard>

    <ConfirmModal
      :model-value="!!toDelete"
      title="Delete conversation?"
      :description="`“${toDelete?.title}” and its messages will be deleted. Usage records are kept for cost tracking.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => !v && (toDelete = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { AiChat, AiChatMessage } from '~/composables/useAi'

const props = defineProps<{
  videoId: number
  /** Transcript new chats are grounded in (defaults server-side when undefined). */
  transcriptId?: number
  /** False while AI isn't configured — sending would only fail. */
  ready: boolean
  /** Shown in the message box when not ready for a reason other than configuration. */
  notReadyReason?: string
  /** Settings › AI message limit. */
  maxChars?: number
}>()

const MAX_CHARS = computed(() => props.maxChars ?? 4000)

const ai = useAi()
const toast = useToast()
const { can } = useAuth()
const canWrite = computed(() => can('ai', 'WRITE'))

const chats = ref<AiChat[]>([])
const active = ref<AiChat | null>(null)
const messages = ref<AiChatMessage[]>([])
const loadingList = ref(true)
const loadingChat = ref(false)
const creating = ref(false)
const deleting = ref(false)
const draft = ref('')
const pending = ref('')
const toDelete = ref<AiChat | null>(null)
const scroller = ref<HTMLElement | null>(null)

async function loadList() {
  try {
    chats.value = await ai.chats(props.videoId)
  } catch (err) {
    toast.add({ title: 'Could not load conversations', description: apiErrorMessage(err), color: 'error' })
  } finally {
    loadingList.value = false
  }
}

async function open(id: number) {
  loadingChat.value = true
  try {
    const chat = await ai.getChat(id)
    active.value = chat
    messages.value = chat.messages ?? []
    scrollDown()
  } catch (err) {
    toast.add({ title: 'Could not open conversation', description: apiErrorMessage(err), color: 'error' })
  } finally {
    loadingChat.value = false
  }
}

// A conversation is only created server-side with its first message, so
// clicking "New chat" and walking away doesn't leave empty chats behind.
function startNew() {
  active.value = null
  messages.value = []
}

async function createChat(): Promise<AiChat | null> {
  creating.value = true
  try {
    const chat = await ai.createChat(props.videoId, props.transcriptId)
    chats.value = [chat, ...chats.value]
    active.value = chat
    messages.value = []
    return chat
  } catch (err) {
    toast.add({ title: 'Could not start a chat', description: apiErrorMessage(err), color: 'error' })
    return null
  } finally {
    creating.value = false
  }
}

async function submit() {
  const text = draft.value.trim()
  if (!text || pending.value || creating.value || !canWrite.value || !props.ready) return
  const isNew = !active.value
  const chat = active.value ?? (await createChat())
  if (!chat) return
  pending.value = text
  draft.value = ''
  scrollDown()
  try {
    const turn = await ai.send(chat.id, text)
    // Ignore the reply if the user switched conversations meanwhile.
    if (active.value?.id === chat.id) {
      messages.value = [...messages.value, turn.userMessage, turn.assistantMessage]
      active.value = turn.chat
    }
    chats.value = [turn.chat, ...chats.value.filter((c) => c.id !== chat.id)]
  } catch (err) {
    // Nothing was stored server-side — give the text back so it can be resent.
    if (!draft.value) draft.value = text
    // Don't leave an empty conversation behind; the resend starts a new one.
    if (isNew) {
      chats.value = chats.value.filter((c) => c.id !== chat.id)
      if (active.value?.id === chat.id) active.value = null
      ai.removeChat(chat.id).catch(() => {})
    }
    toast.add({ title: 'Message not sent', description: apiErrorMessage(err), color: 'error' })
  } finally {
    pending.value = ''
    scrollDown()
  }
}

async function confirmDelete() {
  const chat = toDelete.value
  if (!chat) return
  deleting.value = true
  try {
    await ai.removeChat(chat.id)
    chats.value = chats.value.filter((c) => c.id !== chat.id)
    if (active.value?.id === chat.id) {
      active.value = null
      messages.value = []
    }
    toDelete.value = null
    toast.add({ title: 'Conversation deleted', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not delete', description: apiErrorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

function scrollDown() {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}

onMounted(loadList)
</script>
