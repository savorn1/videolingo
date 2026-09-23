<template>
  <div>
    <PageHeader :title="category?.name ?? 'Category'" :crumbs="[{ label: 'Categories', to: '/categories' }, { label: category?.name ?? '…' }]">
      <template v-if="category" #actions>
        <UButton color="primary" variant="soft" icon="i-lucide-pencil" @click="showForm = true">Edit</UButton>
        <UButton v-if="category.enabled" color="warning" variant="soft" icon="i-lucide-eye-off" :loading="busy" @click="toggle(false)">Disable</UButton>
        <UButton v-else color="success" variant="soft" icon="i-lucide-eye" :loading="busy" @click="toggle(true)">Enable</UButton>
        <UButton color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = true">Delete</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/categories">Back to categories</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !category" :fields="4" :lines="false" />

    <template v-else-if="category">
      <UAlert
        v-if="!category.enabled"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-eye-off"
        title="This category is disabled"
        description="Its videos keep it, but it isn't offered when filing videos and isn't shown to learners."
      />

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <UCard>
          <div class="space-y-4">
            <CategoryBadge :name="category.name" :color="category.color" :enabled="category.enabled" />
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ category.description || 'No description.' }}</p>
            <dl class="space-y-2 text-sm">
              <div v-for="item in facts" :key="item.label" class="flex justify-between gap-4">
                <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
                <dd
                  class="font-semibold text-gray-900 dark:text-white text-right"
                  :class="item.mono ? 'font-mono text-xs' : 'tabular-nums'"
                  :title="item.title"
                >
                  {{ item.value }}
                </dd>
              </div>
            </dl>
          </div>
        </UCard>

        <UCard class="lg:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">Videos in this category</h2>
              <UButton
                v-if="category.videoCount"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-external-link"
                :to="`/videos?categoryId=${category.id}`"
              >
                Open in Videos
              </UButton>
            </div>
          </template>
          <ul v-if="videos.length" class="divide-y divide-gray-100 dark:divide-gray-800">
            <li v-for="v in videos" :key="v.id">
              <NuxtLink :to="`/videos/${v.id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <div class="relative w-20 aspect-video shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <UIcon name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-4 h-4 text-gray-400" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-sm text-gray-900 dark:text-white truncate">{{ v.title }}</p>
                  <p class="text-xs text-gray-500">{{ languageLabel(v.language) }} · {{ formatDuration(v.durationSeconds) }} · {{ v.viewCount }} views</p>
                </div>
                <UBadge :color="v.enabled ? 'success' : 'warning'" variant="subtle" size="sm">{{ v.enabled ? 'Enabled' : 'Disabled' }}</UBadge>
              </NuxtLink>
            </li>
          </ul>
          <EmptyState
            v-else-if="!videosLoading"
            icon="i-lucide-clapperboard"
            title="No videos yet"
            description="File videos under this category from a video's Edit form."
            class="py-10"
          />
          <p v-if="category.videoCount > videos.length" class="px-4 py-3 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
            Showing {{ videos.length }} of {{ category.videoCount }} — open in Videos to see them all.
          </p>
        </UCard>
      </div>
    </template>

    <CategoryFormModal v-model="showForm" :category="category" @saved="(c) => (category = c)" />

    <ConfirmModal
      v-model="confirmDelete"
      title="Delete category"
      :description="
        category?.videoCount
          ? `Delete “${category.name}”? It will be removed from its ${category.videoCount} video(s) — the videos themselves are kept.`
          : `Delete “${category?.name ?? ''}”? No videos use it.`
      "
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { Category } from '~/composables/useCategories'
import type { Video } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { get, setEnabled, remove } = useCategories()
const { list: listVideos } = useVideos()

const id = computed(() => Number(route.params.id))
const category = ref<Category | null>(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const showForm = ref(false)
const confirmDelete = ref(false)

const videos = ref<Video[]>([])
const videosLoading = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    category.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadVideos() {
  videosLoading.value = true
  try {
    videos.value = (await listVideos({ categoryId: id.value, size: 10, sortBy: 'createdAt', sortOrder: 'desc' })).data
  } catch {
    videos.value = []
  } finally {
    videosLoading.value = false
  }
}

const facts = computed(() => {
  const c = category.value
  if (!c) return []
  return [
    { label: 'Videos', value: c.videoCount.toLocaleString() },
    { label: 'Slug', value: c.slug, mono: true },
    { label: 'Display order', value: String(c.sortOrder) },
    { label: 'Updated', value: c.updatedAt ? formatRelativeTime(c.updatedAt) : '—', title: formatDateTime(c.updatedAt) },
    { label: 'Created', value: formatDate(c.createdAt), title: formatDateTime(c.createdAt) }
  ] as { label: string; value: string; mono?: boolean; title?: string }[]
})

async function toggle(enabled: boolean) {
  if (!category.value) return
  busy.value = true
  try {
    category.value = await setEnabled(category.value.id, enabled)
    toast.add({ title: `Category ${enabled ? 'enabled' : 'disabled'}`, color: 'success' })
  } catch (err) {
    toast.add({ title: `Could not ${enabled ? 'enable' : 'disable'} category`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onDelete() {
  if (!category.value) return
  busy.value = true
  try {
    const detached = await remove(category.value.id)
    toast.add({ title: 'Category deleted', description: detached ? `Removed from ${detached} video(s).` : undefined, color: 'success' })
    confirmDelete.value = false
    await navigateTo('/categories')
  } catch (err) {
    toast.add({ title: 'Could not delete category', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  load()
  loadVideos()
})
</script>
