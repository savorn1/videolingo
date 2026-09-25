<template>
  <UModal
    v-model:open="open"
    title="Reorder videos"
    description="Drag the handles, or use the arrows. The new order is used everywhere, including the player."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div v-if="loading" class="space-y-2">
        <USkeleton v-for="i in 4" :key="i" class="h-12" />
      </div>
      <template v-else>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" class="mb-3" />
        <ol class="max-h-[60vh] overflow-y-auto space-y-1 pr-1" @dragover.prevent>
          <li
            v-for="(item, i) in order"
            :key="item.videoId"
            class="flex items-center gap-2 rounded-lg border px-2 py-1.5 bg-white dark:bg-gray-900 transition-colors"
            :class="[
              dragging === i ? 'opacity-40' : '',
              dropTarget === i && dragging !== null && dragging !== i ? 'border-primary-400 ring-1 ring-primary-300' : 'border-gray-200 dark:border-gray-800'
            ]"
            draggable="true"
            @dragstart="onDragStart($event, i)"
            @dragenter.prevent="dropTarget = i"
            @drop.prevent="onDrop(i)"
            @dragend="dragging = dropTarget = null"
          >
            <UIcon name="i-lucide-grip-vertical" class="w-4 h-4 text-gray-400 cursor-grab shrink-0" aria-hidden="true" />
            <span class="w-6 text-right text-xs font-semibold text-gray-400 tabular-nums">{{ i + 1 }}</span>
            <span class="relative w-16 aspect-video shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" alt="" class="w-full h-full object-cover" loading="lazy" />
            </span>
            <span class="min-w-0 flex-1 text-sm truncate" :class="item.deleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'">
              {{ item.title ?? `Video #${item.videoId}` }}
            </span>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-up"
              :disabled="i === 0"
              :aria-label="`Move ${item.title} up`"
              @click="move(i, i - 1)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-down"
              :disabled="i === order.length - 1"
              :aria-label="`Move ${item.title} down`"
              @click="move(i, i + 1)"
            />
          </li>
        </ol>
        <div class="flex items-center justify-between gap-2 mt-4">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-ccw" :disabled="!changed" @click="reset">Undo changes</UButton>
          <div class="flex gap-2">
            <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
            <UButton icon="i-lucide-save" :loading="saving" :disabled="!changed" @click="save">Save order</UButton>
          </div>
        </div>
      </template>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Reorders a whole collection at once — the list page is paginated, so
// dragging there couldn't move a video to another page.
import type { CollectionVideo } from '~/composables/useCollections'

const props = defineProps<{ collectionId: number }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { videos: listItems, reorder } = useCollections()
const toast = useToast()

const original = ref<CollectionVideo[]>([])
const order = ref<CollectionVideo[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const changed = computed(() => order.value.some((item, i) => item.videoId !== original.value[i]?.videoId))

async function load() {
  loading.value = true
  error.value = ''
  try {
    // A collection holds at most 500 videos — one page.
    original.value = (await listItems(props.collectionId, 1, 500)).data
    order.value = [...original.value]
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
watch(open, (isOpen) => isOpen && load())

function move(from: number, to: number) {
  if (to < 0 || to >= order.value.length || from === to) return
  const next = [...order.value]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  order.value = next
}

const dragging = ref<number | null>(null)
const dropTarget = ref<number | null>(null)
function onDragStart(e: DragEvent, i: number) {
  dragging.value = i
  e.dataTransfer?.setData('text/plain', String(i))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDrop(i: number) {
  if (dragging.value !== null) move(dragging.value, i)
  dragging.value = dropTarget.value = null
}

function reset() {
  order.value = [...original.value]
}

async function save() {
  saving.value = true
  try {
    await reorder(
      props.collectionId,
      order.value.map((i) => i.videoId)
    )
    toast.add({ title: 'Order saved', color: 'success' })
    open.value = false
    emit('saved')
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>
