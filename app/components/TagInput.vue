<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-1.5">
      <TagChip v-for="t in video.tags" :key="t.id" :name="t.name" :removable="!disabled" :busy="busyTagId === t.id" @remove="removeTag(t)" />
      <span v-if="!video.tags.length" class="text-xs text-gray-400">No tags yet</span>
    </div>

    <div v-if="!disabled" class="relative">
      <UInput
        v-model="query"
        size="sm"
        icon="i-lucide-hash"
        placeholder="Add a tag…"
        class="w-full"
        :loading="adding"
        aria-label="Add a tag"
        :disabled="atLimit"
        @focus="open = true"
        @blur="closeSoon"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="choose(highlighted)"
        @keydown.escape="open = false"
      />
      <p v-if="atLimit" class="mt-1 text-xs text-gray-500">This video has the maximum of {{ MAX_TAGS }} tags.</p>
      <ul
        v-if="open && options.length"
        class="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 shadow-lg text-sm"
        role="listbox"
      >
        <li
          v-for="(opt, i) in options"
          :key="opt.key"
          role="option"
          :aria-selected="i === highlighted"
          class="flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer"
          :class="i === highlighted ? 'bg-primary-50 dark:bg-primary-950/40' : ''"
          @mousedown.prevent="choose(i)"
          @mouseenter="highlighted = i"
        >
          <span v-if="opt.kind === 'existing'"><span class="text-gray-400">#</span>{{ opt.tag.name }}</span>
          <span v-else class="text-primary-600 dark:text-primary-400">Create “{{ opt.name }}”</span>
          <span v-if="opt.kind === 'existing' && opt.onVideo" class="text-xs text-gray-400">added</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tag } from '~/composables/useTags'
import type { Video } from '~/composables/useVideos'

// Assign / remove tags on one video, with autocomplete over existing tags and
// an inline "Create “…”" when nothing matches exactly. Emits the updated video.
const props = defineProps<{ video: Video; disabled?: boolean }>()
const emit = defineEmits<{ updated: [video: Video] }>()

const { suggest, create, assignToVideo, removeFromVideo } = useTags()
const toast = useToast()

// Settings › Video (the backend enforces the same cap).
const { settings: clientSettings } = useClientSettings()
const MAX_TAGS = computed(() => clientSettings.value?.maxTagsPerVideo ?? 30)

const query = ref('')
const open = ref(false)
const suggestions = ref<Tag[]>([])
const highlighted = ref(0)
const adding = ref(false)
const busyTagId = ref<number | null>(null)

const atLimit = computed(() => props.video.tags.length >= MAX_TAGS.value)
const normalized = computed(() => normalizeTagName(query.value))

type Option = { key: string; kind: 'existing'; tag: Tag; onVideo: boolean } | { key: string; kind: 'create'; name: string }
const options = computed<Option[]>(() => {
  const onVideo = new Set(props.video.tags.map((t) => t.id))
  const list: Option[] = suggestions.value.map((tag) => ({ key: `t${tag.id}`, kind: 'existing', tag, onVideo: onVideo.has(tag.id) }))
  const name = normalized.value
  const exact = suggestions.value.some((t) => t.name.toLowerCase() === name.toLowerCase())
  if (name && !exact && [...name].length <= 50) list.push({ key: 'create', kind: 'create', name })
  return list
})

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(query, () => {
  clearTimeout(timer)
  highlighted.value = 0
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const found = await suggest(normalized.value, 8)
      if (mine === seq) suggestions.value = found
    } catch {
      if (mine === seq) suggestions.value = []
    }
  }, 150)
})

function move(step: number) {
  if (!options.value.length) return
  open.value = true
  highlighted.value = (highlighted.value + step + options.value.length) % options.value.length
}

function closeSoon() {
  setTimeout(() => (open.value = false), 120)
}

async function choose(index: number) {
  const opt = options.value[index]
  if (!opt || adding.value) return
  if (opt.kind === 'existing' && opt.onVideo) {
    query.value = ''
    return
  }
  adding.value = true
  try {
    // "Create" makes the tag first (needs the "tags" permission), then assigns it.
    const tag = opt.kind === 'existing' ? opt.tag : await create({ name: opt.name })
    const updated = await assignToVideo(props.video.id, [tag.id])
    emit('updated', updated)
    query.value = ''
    suggestions.value = []
  } catch (err) {
    toast.add({ title: opt.kind === 'create' ? 'Could not create tag' : 'Could not add tag', description: apiErrorMessage(err), color: 'error' })
  } finally {
    adding.value = false
  }
}

async function removeTag(tag: { id: number; name: string }) {
  busyTagId.value = tag.id
  try {
    emit('updated', await removeFromVideo(props.video.id, tag.id))
  } catch (err) {
    toast.add({ title: `Could not remove #${tag.name}`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyTagId.value = null
  }
}
</script>
