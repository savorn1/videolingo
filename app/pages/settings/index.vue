<template>
  <div>
    <PageHeader title="Settings" description="Application-wide settings. Changes take effect immediately." />

    <div class="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-4 items-start">
      <nav class="lg:sticky lg:top-4" aria-label="Settings sections">
        <ul class="flex lg:flex-col gap-1 overflow-x-auto">
          <li v-for="s in SECTIONS" :key="s.value">
            <button
              type="button"
              class="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left whitespace-nowrap"
              :class="
                section === s.value
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              "
              :aria-current="section === s.value ? 'page' : undefined"
              @click="go(s.value)"
            >
              <UIcon :name="s.icon" class="w-4 h-4 shrink-0" />
              {{ s.label }}
            </button>
          </li>
        </ul>
      </nav>

      <div class="min-w-0">
        <SettingsGeneral v-if="section === 'general'" @dirty="(d: boolean) => (dirty = d)" />
        <SettingsVideo v-else-if="section === 'video'" @dirty="(d: boolean) => (dirty = d)" />
        <SettingsTranslation v-else-if="section === 'translation'" @dirty="(d: boolean) => (dirty = d)" />
        <SettingsAi v-else-if="section === 'ai'" @dirty="(d: boolean) => (dirty = d)" />
        <SettingsStorage v-else @dirty="(d: boolean) => (dirty = d)" />
      </div>
    </div>

    <ConfirmModal
      :model-value="pending !== null"
      title="Discard unsaved changes?"
      description="You have changes in this section that haven't been saved."
      confirm-label="Discard"
      color="warning"
      @update:model-value="(v: boolean) => !v && (pending = null)"
      @confirm="switchTo(pending!)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SettingsSection } from '~/composables/useSettings'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()

const SECTIONS: { value: SettingsSection; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'i-lucide-settings' },
  { value: 'video', label: 'Video', icon: 'i-lucide-video' },
  { value: 'translation', label: 'Translation', icon: 'i-lucide-languages' },
  { value: 'ai', label: 'AI', icon: 'i-lucide-sparkles' },
  { value: 'storage', label: 'Storage', icon: 'i-lucide-hard-drive' }
]

const section = ref<SettingsSection>(SECTIONS.find((s) => s.value === route.query.section)?.value ?? 'general')
const dirty = ref(false)
const pending = ref<SettingsSection | null>(null)

// Switching section drops the current form, so ask first when it has edits.
function go(next: SettingsSection) {
  if (next === section.value) return
  if (dirty.value) pending.value = next
  else switchTo(next)
}

function switchTo(next: SettingsSection) {
  pending.value = null
  dirty.value = false
  section.value = next
  router.replace({ query: { ...route.query, section: next === 'general' ? undefined : next } })
}
</script>
