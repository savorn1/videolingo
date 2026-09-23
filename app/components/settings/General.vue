<template>
  <SettingsPanel
    section="general"
    title="General"
    description="How the app names itself and where replies and links point."
    @dirty="(d: boolean) => emit('dirty', d)"
  >
    <template #default="{ form, defaults, errors, info }">
      <UFormField
        label="Site name"
        required
        :error="errors.siteName"
        :hint="`Default: ${defaults.siteName}`"
        description="Shown in the sidebar, email subjects and the {{appName}} placeholder."
      >
        <UInput v-model="form.siteName" maxlength="60" class="w-full sm:w-96" />
      </UFormField>
      <UFormField
        label="Support email"
        :error="errors.supportEmail"
        description="Used as the reply-to address on notification and password-reset emails. Leave blank for none."
      >
        <UInput v-model="form.supportEmail" type="email" maxlength="120" placeholder="support@example.com" class="w-full sm:w-96" icon="i-lucide-mail" />
      </UFormField>
      <UAlert
        v-if="info.emailConfigured === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-mail-warning"
        title="Email sending isn't configured on the server"
        description="Set MAIL_HOST (and related SMTP settings) in the backend environment — until then no email is sent."
      />
      <UFormField
        label="Public URL"
        :error="errors.publicUrl"
        description="Base address for links in emails (password reset) and the {{appUrl}} placeholder. Leave blank to use the server's configured URL."
      >
        <UInput
          v-model="form.publicUrl"
          maxlength="200"
          :placeholder="String(info.serverFrontendUrl ?? 'https://…')"
          class="w-full sm:w-96"
          icon="i-lucide-link"
        />
      </UFormField>
    </template>
  </SettingsPanel>
</template>

<script setup lang="ts">
const emit = defineEmits<{ dirty: [value: boolean] }>()
</script>
