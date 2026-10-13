<template>
  <UModal v-model:open="open" title="Schedule this video" description="It stays disabled until then, and is enabled by itself at that time.">
    <template #body>
      <div class="space-y-4" data-testid="schedule-modal">
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Quick choices">
          <UButton
            v-for="p in presets"
            :key="p.label"
            size="xs"
            :color="value === toDateTimeLocal(p.at) ? 'primary' : 'neutral'"
            :variant="value === toDateTimeLocal(p.at) ? 'soft' : 'outline'"
            @click="value = toDateTimeLocal(p.at)"
            >{{ p.label }}</UButton
          >
        </div>
        <UFormField label="Enable on" :error="touched ? (problem ?? undefined) : undefined">
          <UInput v-model="value" type="datetime-local" class="w-full" aria-label="Enable on" @blur="touched = true" />
        </UFormField>
        <p class="text-xs text-gray-500 dark:text-gray-400">In your own time. Learners can watch it from then on.</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton v-if="video.publishAt" color="error" variant="ghost" icon="i-lucide-calendar-x" :loading="saving === 'clear'" @click="save(null)"
          >Cancel the schedule</UButton
        >
        <span v-else />
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Close</UButton>
          <UButton icon="i-lucide-calendar-clock" :loading="saving === 'set'" :disabled="!!problem" @click="save(fromDateTimeLocal(value))">Schedule</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Sets or clears when a disabled video is enabled by itself (the backend checks once a minute).
import type { Video } from '~/composables/useVideos'
import { fromDateTimeLocal, schedulePresets, scheduleProblem, toDateTimeLocal } from '#shared/utils/publishSchedule'

const props = defineProps<{ video: Video }>()
const emit = defineEmits<{ saved: [video: Video] }>()
const open = defineModel<boolean>('open', { default: false })

const { schedulePublish } = useVideos()
const toast = useToast()
const value = ref('')
const touched = ref(false)
const saving = ref<'set' | 'clear' | null>(null)
const presets = ref(schedulePresets(new Date()))
const problem = computed(() => scheduleProblem(fromDateTimeLocal(value.value), new Date()))

// Opening starts from the current schedule, or tomorrow at 9:00.
watch(open, (on) => {
  if (!on) return
  presets.value = schedulePresets(new Date())
  touched.value = false
  value.value = props.video.publishAt ? props.video.publishAt.slice(0, 16) : toDateTimeLocal(presets.value[1]!.at)
})

async function save(at: Date | null) {
  saving.value = at ? 'set' : 'clear'
  try {
    const updated = await schedulePublish(props.video.id, at)
    toast.add({
      title: at ? 'Video scheduled' : 'Schedule cancelled',
      description: at ? `It will be enabled ${formatDateTime(updated.publishAt)}.` : 'It stays disabled.',
      color: 'success'
    })
    emit('saved', updated)
    open.value = false
  } catch (err) {
    toast.add({ title: 'Could not save the schedule', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = null
  }
}
</script>
