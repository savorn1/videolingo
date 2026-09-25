<template>
  <SettingsPanel section="video" title="Video" description="Limits and requirements when editing videos." @dirty="(d: boolean) => emit('dirty', d)">
    <template #default="{ form, defaults, errors }">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <UFormField label="Tags per video" :error="errors.maxTagsPerVideo" :hint="`Default: ${defaults.maxTagsPerVideo}`" description="1–100">
          <UInputNumber v-model="form.maxTagsPerVideo" :min="1" :max="100" class="w-40" />
        </UFormField>
        <UFormField label="Categories per video" :error="errors.maxCategoriesPerVideo" :hint="`Default: ${defaults.maxCategoriesPerVideo}`" description="1–50">
          <UInputNumber v-model="form.maxCategoriesPerVideo" :min="1" :max="50" class="w-40" />
        </UFormField>
      </div>
      <USwitch
        v-model="form.requireCategory"
        label="Require a category"
        description="Saving a video's details fails until it has at least one category. Existing videos aren't changed until someone edits them."
      />
      <UFormField
        label="Largest video upload (MB)"
        :error="errors.maxVideoUploadMb"
        :hint="`Default: ${defaults.maxVideoUploadMb} MB`"
        description="Video files are sent straight to storage, so this isn't limited by the server's request size (1–51,200 MB)."
      >
        <UInputNumber v-model="form.maxVideoUploadMb" :min="1" :max="51200" :step="256" class="w-40" />
      </UFormField>
      <UFormField
        label="Statistics window"
        :error="errors.statisticsDefaultDays"
        :hint="`Default: ${defaults.statisticsDefaultDays} days`"
        description="How many days a video's Statistics tab shows when opened (7–365)."
      >
        <UInputNumber v-model="form.statisticsDefaultDays" :min="7" :max="365" class="w-40" />
      </UFormField>
    </template>
  </SettingsPanel>
</template>

<script setup lang="ts">
const emit = defineEmits<{ dirty: [value: boolean] }>()
</script>
