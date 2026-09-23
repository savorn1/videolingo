<template>
  <SettingsPanel
    section="ai"
    title="AI"
    description="Which AI features are on, the Claude model they use, spending limits and defaults."
    @dirty="(d: boolean) => emit('dirty', d)"
  >
    <template #default="{ form, defaults, errors, info }">
      <UAlert
        v-if="info.apiKeyConfigured === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-plug-zap"
        title="No API key on the server"
        description="Set ANTHROPIC_API_KEY in the backend environment — AI stays unavailable until then, whatever is switched on here."
      />

      <USwitch
        v-model="form.enabled"
        label="AI features on"
        description="Turning this off stops every AI request (generation and chat). Existing results stay viewable."
      />

      <!-- A fieldset, not a UFormField: the form field hands its single id to
           every checkbox inside, which breaks each one's own label. -->
      <fieldset>
        <legend class="text-sm font-medium text-gray-900 dark:text-white">Features</legend>
        <p class="text-sm text-gray-500 dark:text-gray-400">Each can be switched off on its own.</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          <UCheckbox v-for="f in FEATURES" :key="f.key" v-model="form[f.key]" :label="f.label" :disabled="!form.enabled" />
        </div>
      </fieldset>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <UFormField label="Model" required :error="errors.model" :hint="`Default: ${defaults.model}`">
          <UInput v-model="form.model" maxlength="80" class="w-full font-mono" />
          <div class="flex flex-wrap gap-1 mt-1.5">
            <UButton
              v-for="m in priced(info)"
              :key="m"
              size="xs"
              color="neutral"
              :variant="form.model === m ? 'solid' : 'soft'"
              class="font-mono"
              @click="form.model = m"
            >
              {{ m }}
            </UButton>
          </div>
          <p v-if="form.model && !priced(info).includes(form.model)" class="text-xs text-warning-700 dark:text-warning-400 mt-1">
            No price configured for this model — its requests will be tracked without a cost.
          </p>
        </UFormField>
        <UFormField label="Fallback model" :error="errors.fallbackModel" description="Retried once if the main model declines. Blank = no retry.">
          <UInput v-model="form.fallbackModel" maxlength="80" placeholder="None" class="w-full font-mono" />
          <div class="flex flex-wrap gap-1 mt-1.5">
            <UButton size="xs" color="neutral" :variant="!form.fallbackModel ? 'solid' : 'soft'" @click="form.fallbackModel = ''">None</UButton>
            <UButton
              v-for="m in priced(info).filter((x) => x !== form.model)"
              :key="m"
              size="xs"
              color="neutral"
              :variant="form.fallbackModel === m ? 'solid' : 'soft'"
              class="font-mono"
              @click="form.fallbackModel = m"
            >
              {{ m }}
            </UButton>
          </div>
        </UFormField>
        <UFormField
          label="Effort for generated results"
          :error="errors.generationEffort"
          :hint="`Default: ${defaults.generationEffort}`"
          description="Higher is more thorough, slower and costlier."
        >
          <USelect v-model="form.generationEffort" :items="EFFORTS" class="w-40" aria-label="Generation effort" />
        </UFormField>
        <UFormField label="Effort for chat" :error="errors.chatEffort" :hint="`Default: ${defaults.chatEffort}`">
          <USelect v-model="form.chatEffort" :items="EFFORTS" class="w-40" aria-label="Chat effort" />
        </UFormField>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
        <p class="font-medium text-gray-900 dark:text-white">Monthly budget</p>
        <div class="flex flex-wrap items-end gap-6">
          <UFormField label="Budget (USD)" :error="errors.monthlyBudgetUsd" description="Blank = no budget.">
            <UInputNumber
              :model-value="form.monthlyBudgetUsd ?? undefined"
              :min="0"
              :step="5"
              :format-options="{ style: 'currency', currency: 'USD' }"
              placeholder="No budget"
              class="w-44"
              @update:model-value="(v: number | undefined | null) => (form.monthlyBudgetUsd = v ?? null)"
            />
          </UFormField>
          <USwitch v-model="form.budgetEnforced" label="Stop AI requests when it's used up" :disabled="form.monthlyBudgetUsd == null" />
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <UFormField label="Chat message limit" :error="errors.maxChatMessageChars" :description="`Characters · default ${defaults.maxChatMessageChars}`">
          <UInputNumber v-model="form.maxChatMessageChars" :min="200" :max="20000" :step="100" class="w-full" />
        </UFormField>
        <UFormField label="Key points" :error="errors.defaultKeyPoints" :description="`Default count · default ${defaults.defaultKeyPoints}`">
          <UInputNumber v-model="form.defaultKeyPoints" :min="1" :max="20" class="w-full" />
        </UFormField>
        <UFormField label="Questions" :error="errors.defaultQuestions" :description="`Default count · default ${defaults.defaultQuestions}`">
          <UInputNumber v-model="form.defaultQuestions" :min="1" :max="20" class="w-full" />
        </UFormField>
        <UFormField label="Quiz questions" :error="errors.defaultQuizQuestions" :description="`Default count · default ${defaults.defaultQuizQuestions}`">
          <UInputNumber v-model="form.defaultQuizQuestions" :min="1" :max="20" class="w-full" />
        </UFormField>
      </div>
    </template>
  </SettingsPanel>
</template>

<script setup lang="ts">
import type { AiSettings } from '~/composables/useSettings'

const emit = defineEmits<{ dirty: [value: boolean] }>()

const FEATURES: { key: keyof AiSettings & `${string}Enabled`; label: string }[] = [
  { key: 'summaryEnabled', label: 'Summary' },
  { key: 'chaptersEnabled', label: 'Chapters' },
  { key: 'keyPointsEnabled', label: 'Key points' },
  { key: 'questionsEnabled', label: 'Questions' },
  { key: 'quizEnabled', label: 'Quiz' },
  { key: 'chatEnabled', label: 'AI chat' }
]
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'].map((v) => ({ label: v, value: v }))

function priced(info: Record<string, unknown>): string[] {
  return Array.isArray(info.pricedModels) ? (info.pricedModels as string[]) : []
}
</script>
