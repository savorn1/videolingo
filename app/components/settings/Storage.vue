<template>
  <SettingsPanel
    section="storage"
    title="Storage"
    description="Upload limits and the storage quota. Where files are stored is set in the server environment."
    @dirty="(d: boolean) => emit('dirty', d)"
  >
    <template #default="{ form, defaults, errors, info }">
      <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
        <p class="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <UIcon name="i-lucide-hard-drive" class="w-4 h-4" /> Object storage
          <UBadge v-if="info.configured" color="success" variant="subtle" size="sm" icon="i-lucide-check">Configured</UBadge>
          <UBadge v-else color="warning" variant="subtle" size="sm" icon="i-lucide-triangle-alert">No bucket set</UBadge>
        </p>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <div v-for="row in infoRows(info)" :key="row.label" class="flex justify-between gap-3 min-w-0">
            <dt class="text-gray-500 shrink-0">{{ row.label }}</dt>
            <dd class="font-mono text-xs text-gray-800 dark:text-gray-200 truncate" :title="row.value">{{ row.value }}</dd>
          </div>
        </dl>
        <p class="text-xs text-gray-500 mt-2">Change these with the S3_* / AWS_* environment variables and spring.servlet.multipart.max-file-size.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <UFormField
          label="File uploads (MB)"
          :error="errors.maxUploadMb"
          :hint="`Default ${defaults.maxUploadMb}`"
          :description="`Images and documents via the upload endpoint. The server accepts at most ${info.multipartLimitMb} MB.`"
        >
          <UInputNumber v-model="form.maxUploadMb" :min="1" :max="Number(info.multipartLimitMb) || 10240" class="w-40" />
        </UFormField>
        <UFormField
          label="Subtitle files (MB)"
          :error="errors.maxSubtitleUploadMb"
          :hint="`Default ${defaults.maxSubtitleUploadMb}`"
          description=".srt / .vtt uploads."
        >
          <UInputNumber v-model="form.maxSubtitleUploadMb" :min="1" :max="Number(info.multipartLimitMb) || 1024" class="w-40" />
        </UFormField>
      </div>

      <UFormField label="Allowed upload types" :error="typesError(errors)" description="MIME types or families like image/*. Leave empty to accept any type.">
        <UInputTags v-model="form.allowedUploadTypes" placeholder="Add a type, e.g. image/*" class="w-full sm:w-[28rem]" aria-label="Allowed upload types" />
        <div class="flex flex-wrap gap-1 mt-1.5">
          <UButton
            v-for="t in SUGGESTED_TYPES.filter((x) => !form.allowedUploadTypes.includes(x))"
            :key="t"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-plus"
            class="font-mono"
            @click="form.allowedUploadTypes = [...form.allowedUploadTypes, t]"
          >
            {{ t }}
          </UButton>
        </div>
      </UFormField>

      <UFormField
        label="Storage quota (GB)"
        :error="errors.storageQuotaGb"
        description="Analytics shows stored video against it. Blank = no quota. Nothing is blocked when it's exceeded."
      >
        <UInputNumber
          :model-value="form.storageQuotaGb ?? undefined"
          :min="0.1"
          :step="10"
          placeholder="No quota"
          class="w-44"
          @update:model-value="(v: number | undefined | null) => (form.storageQuotaGb = v ?? null)"
        />
      </UFormField>
    </template>
  </SettingsPanel>
</template>

<script setup lang="ts">
const emit = defineEmits<{ dirty: [value: boolean] }>()

const SUGGESTED_TYPES = ['image/*', 'application/pdf', 'video/*', 'audio/*', 'text/plain']

function infoRows(info: Record<string, unknown>) {
  return [
    { label: 'Bucket', value: String(info.bucket || '—') },
    { label: 'Region', value: String(info.region || '—') },
    { label: 'Endpoint', value: String(info.endpoint || '—') },
    { label: 'Public URL base', value: String(info.publicEndpoint || '—') },
    { label: 'Server upload cap', value: `${info.multipartLimitMb} MB` }
  ]
}

function typesError(errors: Record<string, string>) {
  const key = Object.keys(errors).find((k) => k.startsWith('allowedUploadTypes'))
  return key ? errors[key] : undefined
}
</script>
