<template>
  <div>
    <PageHeader :title="collection?.title ?? 'Collection'" :crumbs="[{ label: 'Collections', to: '/collections' }, { label: collection?.title ?? '…' }]">
      <template v-if="collection" #actions>
        <UButton v-if="items.some((i) => !i.deleted)" color="primary" icon="i-lucide-play" :to="`/collections/${collection.id}/play`">Play all</UButton>
        <UButton
          v-if="items.filter((i) => !i.deleted).length > 1"
          color="neutral"
          variant="soft"
          icon="i-lucide-shuffle"
          :to="`/collections/${collection.id}/play?shuffle=1`"
        >
          Shuffle
        </UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-plus" @click="openAdd">Add videos</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-pencil" @click="showForm = true">Edit</UButton>
        <UButton color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = true">Delete</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/collections">Back to collections</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !collection" :fields="4" />

    <div v-else-if="collection" class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <!-- Details -->
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="overflow-hidden xl:sticky xl:top-4">
        <CollectionCover :src="collection.coverUrl" />
        <div class="p-4 space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge :color="visibility.color" variant="subtle" :icon="visibility.icon">{{ visibility.label }}</UBadge>
            <span class="text-xs text-gray-500 self-center">{{ visibility.description }}</span>
          </div>
          <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ collection.description || 'No description.' }}</p>
          <dl class="space-y-2 text-sm">
            <div v-for="item in facts" :key="item.label" class="flex justify-between gap-4">
              <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
              <dd
                class="font-semibold text-gray-900 dark:text-white text-right truncate"
                :class="item.mono ? 'font-mono text-xs' : 'tabular-nums'"
                :title="item.title"
              >
                <NuxtLink v-if="item.to" :to="item.to" class="text-primary-600 dark:text-primary-400 hover:underline">{{ item.value }}</NuxtLink>
                <template v-else>{{ item.value }}</template>
              </dd>
            </div>
          </dl>
          <UAlert
            v-if="collection.trashedVideoCount || collection.disabledVideoCount"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Some videos can't be watched"
            :description="unwatchableText"
          />
        </div>
      </UCard>

      <!-- View Collection Videos -->
      <UCard class="xl:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-gray-900 dark:text-white">Videos</h2>
            <UBadge color="neutral" variant="subtle" size="sm">{{ collection.videoCount }}</UBadge>
            <UButton
              v-if="collection.videoCount > 1"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-arrow-up-down"
              class="ml-auto"
              @click="showReorder = true"
            >
              Reorder
            </UButton>
          </div>
        </template>
        <div v-if="videosLoading && !items.length" class="p-4 space-y-3">
          <USkeleton v-for="i in 3" :key="i" class="h-14" />
        </div>
        <ol v-else-if="items.length" class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="item in items" :key="item.videoId" class="flex items-center gap-3 px-4 py-3" :class="item.deleted ? 'opacity-60' : ''">
            <span class="w-6 text-right text-sm font-semibold text-gray-400 tabular-nums">{{ item.position + 1 }}</span>
            <NuxtLink :to="`/videos/${item.videoId}`" class="relative w-24 aspect-video shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                v-if="item.thumbnailUrl && !brokenThumbs.has(item.videoId)"
                :src="item.thumbnailUrl"
                alt=""
                class="w-full h-full object-cover"
                loading="lazy"
                @error="brokenThumbs.add(item.videoId)"
              />
              <UIcon v-else name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-4 h-4 text-gray-400" />
              <span
                v-if="item.durationSeconds !== null"
                class="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-semibold text-white tabular-nums"
              >
                {{ formatDuration(item.durationSeconds) }}
              </span>
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/videos/${item.videoId}`" class="block font-semibold text-sm text-gray-900 dark:text-white truncate hover:underline">
                {{ item.title ?? `Video #${item.videoId}` }}
              </NuxtLink>
              <p class="text-xs text-gray-500 truncate">
                {{ languageLabel(item.language) }} · added {{ formatRelativeTime(item.addedAt) }}{{ item.addedBy ? ` by ${item.addedBy}` : '' }}
              </p>
            </div>
            <UBadge v-if="item.deleted" color="error" variant="subtle" size="sm" icon="i-lucide-trash-2">In trash</UBadge>
            <UBadge v-else-if="!item.enabled" color="warning" variant="subtle" size="sm" icon="i-lucide-eye-off">Disabled</UBadge>
            <UTooltip v-if="!item.deleted" text="Play from here">
              <UButton
                size="xs"
                color="primary"
                variant="ghost"
                icon="i-lucide-play"
                :aria-label="`Play the collection from ${item.title ?? 'this video'}`"
                :to="`/collections/${collection?.id}/play?v=${item.videoId}`"
              />
            </UTooltip>
            <UTooltip text="Remove from collection">
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-x"
                :aria-label="`Remove ${item.title ?? 'video'} from collection`"
                @click="confirmRemove = item"
              />
            </UTooltip>
          </li>
        </ol>
        <EmptyState v-else icon="i-lucide-list-video" title="No videos in this collection" description="Add videos to start building it." class="py-10">
          <template #action>
            <UButton icon="i-lucide-plus" @click="openAdd">Add videos</UButton>
          </template>
        </EmptyState>
        <div v-if="itemsTotal > itemsPageSize" class="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <DataPagination v-model:page="itemsPage" v-model:page-size="itemsPageSize" :total="itemsTotal" />
        </div>
      </UCard>
    </div>

    <CollectionFormModal v-model="showForm" :collection="collection" @saved="load" />

    <!-- Add videos -->
    <UModal v-model:open="showAdd" title="Add videos" :ui="{ content: 'sm:max-w-lg' }">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Videos" description="Added to the end, in the order you pick them. Videos already here are greyed out.">
            <USelectMenu
              v-model="addIds"
              :items="addOptions"
              value-key="value"
              multiple
              placeholder="Choose videos"
              :search-input="{ placeholder: 'Search videos…' }"
              :loading="addLoading"
              aria-label="Videos to add"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showAdd = false">Cancel</UButton>
            <UButton icon="i-lucide-plus" :loading="busy" :disabled="!addIds.length" @click="onAdd">
              Add {{ addIds.length || '' }} video{{ addIds.length === 1 ? '' : 's' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmRemove !== null"
      title="Remove from collection"
      :description="`Remove “${confirmRemove?.title ?? 'this video'}” from “${collection?.title ?? ''}”? The video itself isn't deleted.`"
      confirm-label="Remove"
      color="warning"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (confirmRemove = null)"
      @confirm="confirmRemove && onRemove(confirmRemove)"
    />
    <ConfirmModal
      v-model="confirmDelete"
      title="Delete collection"
      :description="`Delete “${collection?.title ?? ''}”? Its ${collection?.videoCount ?? 0} video(s) are not deleted — only the collection.`"
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @confirm="onDelete"
    />
    <CollectionReorderModal v-model:open="showReorder" :collection-id="id" @saved="loadItems" />
  </div>
</template>

<script setup lang="ts">
import { COLLECTION_VISIBILITIES, type Collection, type CollectionVideo } from '~/composables/useCollections'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { get, remove, videos: listItems, addVideos, removeVideo } = useCollections()
const { list: listVideos } = useVideos()

const id = computed(() => Number(route.params.id))
const collection = ref<Collection | null>(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const showForm = ref(false)
const confirmDelete = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    collection.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const visibility = computed(() => COLLECTION_VISIBILITIES.find((v) => v.value === collection.value?.visibility) ?? COLLECTION_VISIBILITIES[2]!)

const facts = computed(() => {
  const c = collection.value
  if (!c) return []
  return [
    { label: 'Videos', value: c.videoCount.toLocaleString() },
    { label: 'Total length', value: formatWatchTime(c.totalDurationSeconds ?? 0) },
    { label: 'Owner', value: c.ownerUsername ?? '—', to: c.ownerUsername ? `/users/${c.ownerId}` : undefined },
    { label: 'Slug', value: c.slug, mono: true },
    { label: 'Updated', value: c.updatedAt ? formatRelativeTime(c.updatedAt) : '—', title: formatDateTime(c.updatedAt) },
    { label: 'Created', value: formatDate(c.createdAt), title: formatDateTime(c.createdAt) }
  ] as { label: string; value: string; to?: string; mono?: boolean; title?: string }[]
})

const unwatchableText = computed(() => {
  const c = collection.value
  if (!c) return ''
  const trashed = c.trashedVideoCount ?? 0
  const disabled = c.disabledVideoCount ?? 0
  const parts = [trashed ? `${trashed} in the trash` : '', disabled ? `${disabled} disabled` : ''].filter(Boolean)
  const one = trashed + disabled === 1
  return `${parts.join(' and ')} — learners won't see ${one ? 'it' : 'them'}. Remove ${one ? 'it' : 'them'} from the collection, or restore ${one ? 'it' : 'them'}.`
})

// ── Items ──────────────────────────────────────────────────────────────────
const items = ref<CollectionVideo[]>([])
const itemsTotal = ref(0)
const itemsPage = ref(1)
const itemsPageSize = ref(50)
const videosLoading = ref(false)
const brokenThumbs = reactive(new Set<number>())

async function loadItems() {
  videosLoading.value = true
  try {
    const res = await listItems(id.value, itemsPage.value, itemsPageSize.value)
    items.value = res.data
    itemsTotal.value = res.metadata.totalCount
  } catch (err) {
    toast.add({ title: 'Could not load videos', description: apiErrorMessage(err), color: 'error' })
  } finally {
    videosLoading.value = false
  }
}
watch([itemsPage, itemsPageSize], loadItems)

const showReorder = ref(false)

// ── Remove video ───────────────────────────────────────────────────────────
const confirmRemove = ref<CollectionVideo | null>(null)
async function onRemove(item: CollectionVideo) {
  busy.value = true
  try {
    collection.value = await removeVideo(id.value, item.videoId)
    toast.add({ title: 'Removed from collection', color: 'success' })
    confirmRemove.value = null
    await loadItems()
  } catch (err) {
    toast.add({ title: 'Could not remove video', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ── Add videos ─────────────────────────────────────────────────────────────
const showAdd = ref(false)
const addIds = ref<number[]>([])
const addLoading = ref(false)
const candidates = ref<{ id: number; title: string }[]>([])
const presentIds = ref(new Set<number>())
const addOptions = computed(() =>
  candidates.value.map((v) => ({
    label: presentIds.value.has(v.id) ? `${v.title} (already here)` : v.title,
    value: v.id,
    disabled: presentIds.value.has(v.id)
  }))
)

async function openAdd() {
  addIds.value = []
  showAdd.value = true
  addLoading.value = true
  try {
    const [vids, all] = await Promise.all([listVideos({ size: 500, sortBy: 'title', sortOrder: 'asc' }), listItems(id.value, 1, 500)])
    candidates.value = vids.data
    presentIds.value = new Set(all.data.map((i) => i.videoId))
  } catch {
    candidates.value = []
  } finally {
    addLoading.value = false
  }
}

async function onAdd() {
  busy.value = true
  try {
    const added = await addVideos(id.value, addIds.value)
    toast.add({ title: added ? `Added ${added} video(s)` : 'Those videos are already in the collection', color: 'success' })
    showAdd.value = false
    await Promise.all([load(), loadItems()])
  } catch (err) {
    toast.add({ title: 'Could not add videos', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
async function onDelete() {
  busy.value = true
  try {
    await remove(id.value)
    toast.add({ title: 'Collection deleted', color: 'success' })
    confirmDelete.value = false
    await navigateTo('/collections')
  } catch (err) {
    toast.add({ title: 'Could not delete collection', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  load()
  loadItems()
})
</script>
