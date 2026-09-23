<template>
  <UModal v-model:open="open" :title="category ? `Edit ${category.name}` : 'New category'" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Name" required>
          <UInput v-model="form.name" maxlength="100" placeholder="e.g. Food & Drink" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Slug" :hint="category ? 'Changing it breaks old links' : 'optional'" :description="slugDescription">
          <UInput v-model="form.slug" maxlength="120" :placeholder="slugPreview || 'generated from the name'" icon="i-lucide-link" class="w-full font-mono" />
        </UFormField>

        <UFormField label="Description" hint="optional">
          <UTextarea v-model="form.description" :rows="2" maxlength="500" class="w-full" placeholder="What kind of videos belong here?" />
        </UFormField>

        <UFormField label="Color">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="c in CATEGORY_COLORS"
              :key="c"
              type="button"
              class="h-6 w-6 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-gray-900 transition"
              :class="[SWATCH[c], form.color === c ? 'ring-2 ring-gray-900 dark:ring-white' : 'hover:scale-110']"
              :aria-label="c"
              :aria-pressed="form.color === c"
              @click="form.color = form.color === c ? '' : c"
            />
          </div>
        </UFormField>

        <div class="grid grid-cols-2 gap-4 items-end">
          <UFormField label="Display order" hint="lower first">
            <UInputNumber v-model="form.sortOrder" :min="-10000" :max="10000" class="w-full" />
          </UFormField>
          <USwitch v-if="!category" v-model="form.enabled" label="Enabled" />
        </div>

        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          Preview:
          <CategoryBadge :name="form.name.trim() || 'Category'" :color="form.color || null" :enabled="category ? category.enabled : form.enabled" />
        </div>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton type="submit" :loading="saving" :disabled="!form.name.trim()">{{ category ? 'Save changes' : 'Create' }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Category } from '~/composables/useCategories'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ category?: Category | null }>()
const emit = defineEmits<{ saved: [category: Category] }>()

const { create, update } = useCategories()
const toast = useToast()

// Swatch fill per palette name (literal classes, for Tailwind).
const SWATCH: Record<string, string> = {
  gray: 'bg-gray-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-400',
  lime: 'bg-lime-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  purple: 'bg-purple-500',
  fuchsia: 'bg-fuchsia-500',
  pink: 'bg-pink-500',
  rose: 'bg-rose-500'
}

const form = reactive({ name: '', slug: '', description: '', color: '', sortOrder: 0, enabled: true })
const saving = ref(false)
const error = ref('')

// Same rule as the backend's slug(): letters (any script, with their marks)
// and digits, everything else collapses to single dashes.
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
// What the slug will be on save: the typed one, else (editing) the current
// one — a blank slug keeps it — else (creating) one generated from the name.
const slugPreview = computed(() => (form.slug.trim() ? slugify(form.slug) : (props.category?.slug ?? slugify(form.name))))
const slugDescription = computed(() => (slugPreview.value ? `/categories/${slugPreview.value}` : undefined))

watch(open, (value) => {
  if (!value) return
  error.value = ''
  const c = props.category
  Object.assign(form, {
    name: c?.name ?? '',
    // Editing shows the slug as a placeholder only — left blank, it's kept as is.
    slug: '',
    description: c?.description ?? '',
    color: c?.color ?? '',
    sortOrder: c?.sortOrder ?? 0,
    enabled: c?.enabled ?? true
  })
})

async function onSubmit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      color: form.color || undefined,
      sortOrder: form.sortOrder ?? 0
    }
    const saved = props.category ? await update(props.category.id, payload) : await create({ ...payload, enabled: form.enabled })
    toast.add({ title: props.category ? 'Category updated' : `${saved.name} created`, color: 'success' })
    open.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>
