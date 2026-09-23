<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
        </div>
        <div v-if="view" class="text-xs text-gray-500 text-right">
          <template v-if="view.customized && view.updatedAt"> Changed {{ formatRelativeTime(view.updatedAt) }} by {{ view.updatedBy ?? '—' }} </template>
          <UBadge v-else color="neutral" variant="subtle" size="sm">Using defaults</UBadge>
        </div>
      </div>
    </template>

    <UAlert v-if="loadError" color="error" variant="subtle" :title="loadError" icon="i-lucide-triangle-alert" />
    <div v-else-if="!form" class="space-y-4">
      <USkeleton v-for="i in 4" :key="i" class="h-12" />
    </div>
    <!-- novalidate: the server reports every problem inline, the same way for all fields -->
    <form v-else class="space-y-6" novalidate @submit.prevent="onSave">
      <UAlert
        v-if="!canWrite"
        color="neutral"
        variant="subtle"
        icon="i-lucide-lock"
        title="Read-only"
        description="You can view these settings but not change them."
      />
      <fieldset :disabled="!canWrite || saving" class="space-y-6 min-w-0">
        <slot :form="form" :defaults="view!.defaults" :errors="errors" :info="view!.info" />
      </fieldset>

      <UAlert v-if="saveError" color="error" variant="subtle" :title="saveError" icon="i-lucide-triangle-alert">
        <template v-if="conflict" #actions>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-refresh-cw" @click="load">Reload</UButton>
        </template>
      </UAlert>

      <div v-if="canWrite" class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
        <UButton color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!view!.customized || saving" @click="confirmReset = true">
          Restore defaults
        </UButton>
        <div class="flex gap-2">
          <UButton v-if="dirty" color="neutral" variant="ghost" :disabled="saving" @click="discard">Discard changes</UButton>
          <UButton type="submit" icon="i-lucide-save" :loading="saving" :disabled="!dirty">Save changes</UButton>
        </div>
      </div>
    </form>

    <ConfirmModal
      :model-value="confirmReset"
      :title="`Restore ${title.toLowerCase()} defaults?`"
      description="Every setting in this section goes back to its built-in default. This takes effect immediately."
      confirm-label="Restore defaults"
      color="warning"
      :loading="saving"
      @update:model-value="(v: boolean) => !v && !saving && (confirmReset = false)"
      @confirm="onReset"
    />
  </UCard>
</template>

<script setup lang="ts" generic="S extends SettingsSection">
import type { SectionView, SettingsBySection, SettingsSection } from '~/composables/useSettings'

const props = defineProps<{ section: S; title: string; description: string }>()
const emit = defineEmits<{ dirty: [value: boolean] }>()

const settingsApi = useSettings()
const toast = useToast()
const { can } = useAuth()
const canWrite = computed(() => can('settings', 'WRITE'))

const view = ref<SectionView<S> | null>(null) as Ref<SectionView<S> | null>
const form = ref<SettingsBySection[S] | null>(null) as Ref<SettingsBySection[S] | null>
const loadError = ref('')
const saveError = ref('')
const conflict = ref(false)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const confirmReset = ref(false)

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const dirty = computed(() => !!view.value && !!form.value && JSON.stringify(form.value) !== JSON.stringify(view.value.values))
watch(dirty, (d) => emit('dirty', d), { immediate: true })
useUnsavedChangesGuard(dirty)

function apply(next: SectionView<S>) {
  view.value = next
  form.value = clone(next.values)
  errors.value = {}
  saveError.value = ''
  conflict.value = false
}

async function load() {
  loadError.value = ''
  try {
    apply(await settingsApi.get(props.section))
  } catch (err) {
    loadError.value = apiErrorMessage(err)
  }
}

function discard() {
  if (view.value) form.value = clone(view.value.values)
  errors.value = {}
  saveError.value = ''
}

async function onSave() {
  if (!form.value || !view.value) return
  saving.value = true
  saveError.value = ''
  errors.value = {}
  conflict.value = false
  try {
    apply(await settingsApi.save(props.section, form.value, view.value.version))
    toast.add({ title: `${props.title} settings saved`, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { errors?: Record<string, string> } })?.data
    errors.value = data?.errors ?? {}
    conflict.value = (err as { response?: { status?: number } })?.response?.status === 409
    saveError.value = Object.keys(errors.value).length ? 'Some values need fixing — see the highlighted fields.' : apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

async function onReset() {
  saving.value = true
  try {
    apply(await settingsApi.reset(props.section))
    confirmReset.value = false
    toast.add({ title: `${props.title} settings restored to defaults`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not restore defaults', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
