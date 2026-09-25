<template>
  <SettingsPanel
    section="translation"
    title="Translation"
    description="Starting points for new translations and subtitle tracks, and publishing rules."
    @dirty="(d: boolean) => emit('dirty', d)"
  >
    <template #default="{ form, defaults, errors }">
      <UFormField
        label="Suggested translation languages"
        :error="errors.defaultTargetLanguages"
        description="Offered first when adding a translation to a video."
      >
        <USelectMenu
          v-model="form.defaultTargetLanguages"
          :items="languageOptions().map((o) => ({ label: o.label, value: o.value! }))"
          value-key="value"
          multiple
          placeholder="None"
          :search-input="{ placeholder: 'Search languages…' }"
          aria-label="Suggested translation languages"
          class="w-full sm:w-[28rem]"
        />
      </UFormField>

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <div>
          <p class="font-medium text-gray-900 dark:text-white">Subtitle rules — most languages</p>
          <p class="text-xs text-gray-500">What a new subtitle track is built to and checked against. Each track can still change its own rules.</p>
        </div>
        <SettingsRuleFields v-model="form.standardRules" :defaults="defaults.standardRules" :errors="errors" prefix="standardRules" />
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <div>
          <p class="font-medium text-gray-900 dark:text-white">Subtitle rules — compact scripts</p>
          <p class="text-xs text-gray-500">
            For languages that pack more meaning per character, such as Japanese and Chinese: shorter lines, slower reading speed.
          </p>
        </div>
        <SettingsRuleFields v-model="form.compactRules" :defaults="defaults.compactRules" :errors="errors" prefix="compactRules" />
        <UFormField
          label="Languages using these rules"
          :error="compactError(errors)"
          description="Two- or three-letter language codes; regional variants follow them (zh covers zh-TW)."
        >
          <UInputTags v-model="form.compactLanguages" placeholder="Add a code, e.g. ko" class="w-full sm:w-[28rem]" aria-label="Compact-script languages" />
        </UFormField>
      </div>

      <USwitch
        v-model="form.blockPublishWithIssues"
        label="Don't publish subtitles with readability issues"
        description="Publishing a track fails while it has lines that break its rules (too long, too fast, too short on screen…)."
      />
      <USwitch
        v-model="form.requireApprovalToPublish"
        label="Require review before publishing"
        description="A track can only be published once a reviewer has approved it. Editing an approved track sends it back for review."
      />
    </template>
  </SettingsPanel>
</template>

<script setup lang="ts">
const emit = defineEmits<{ dirty: [value: boolean] }>()

// List errors come back per element ("compactLanguages[2]"); show the first on the field.
function compactError(errors: Record<string, string>) {
  const key = Object.keys(errors).find((k) => k.startsWith('compactLanguages'))
  return key ? `${key.replace('compactLanguages', 'Entry ').replace(/\[(\d+)\]/, (_, i) => String(Number(i) + 1))}: ${errors[key]}` : undefined
}
</script>
