<template>
  <UModal v-model:open="open" :title="template ? `Edit ${template.name}` : 'New template'" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Name" required>
            <UInput v-model="form.name" maxlength="100" placeholder="e.g. New course" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Code" required :description="template ? undefined : 'Stable ID — lower-case, hyphens'">
            <UInput v-model="form.code" maxlength="60" :placeholder="codePreview || 'new-course'" icon="i-lucide-hash" class="w-full font-mono" />
          </UFormField>
        </div>

        <UFormField label="Description" hint="optional">
          <UInput v-model="form.description" maxlength="300" placeholder="When is this used?" class="w-full" />
        </UFormField>

        <UFormField label="Subject" required :hint="`${form.subject.length}/200`">
          <UInput v-model="form.subject" maxlength="200" placeholder="New on {{appName}}: {{course}}" class="w-full" />
        </UFormField>

        <UFormField label="Message" required :hint="`${form.body.length}/10000`">
          <UTextarea ref="bodyInput" v-model="form.body" :rows="7" autoresize :maxrows="16" maxlength="10000" class="w-full font-mono text-sm" />
        </UFormField>

        <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3 space-y-2 text-xs">
          <p class="text-gray-600 dark:text-gray-400">
            Insert <code>&#123;&#123;name&#125;&#125;</code> placeholders. Built-ins are filled per recipient — click to add:
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="v in BUILT_IN_VARIABLES"
              :key="v.name"
              size="xs"
              color="neutral"
              variant="soft"
              class="font-mono"
              :title="v.description"
              @click="insertVariable(v.name)"
            >
              &#123;&#123;{{ v.name }}&#125;&#125;
            </UButton>
          </div>
          <p v-if="custom.length" class="text-gray-600 dark:text-gray-400">
            Asked for when sending:
            <UBadge v-for="v in custom" :key="v" color="primary" variant="subtle" size="sm" class="font-mono ml-1">{{ v }}</UBadge>
          </p>
        </div>

        <UFormField label="Default channels" required description="Pre-selected when sending with this template">
          <UCheckboxGroup v-model="form.defaultChannels" :items="channelItems" orientation="horizontal" :ui="{ fieldset: 'gap-x-6 gap-y-2 flex-wrap' }" />
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton type="submit" :loading="saving" :disabled="!canSave">{{ template ? 'Save changes' : 'Create' }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { NotificationChannel } from '#shared/utils/notifications'
import type { NotificationTemplate } from '~/composables/useNotifications'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ template?: NotificationTemplate | null }>()
const emit = defineEmits<{ saved: [template: NotificationTemplate] }>()

const { createTemplate, updateTemplate } = useNotifications()
const toast = useToast()

const channelItems = NOTIFICATION_CHANNELS.map((c) => ({ label: c.label, description: c.description, value: c.value }))

const form = reactive({ name: '', code: '', description: '', subject: '', body: '', defaultChannels: ['IN_APP'] as NotificationChannel[] })
const saving = ref(false)
const error = ref('')
const bodyInput = ref<{ textareaRef?: HTMLTextAreaElement } | null>(null)

function toCode(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
const codePreview = computed(() => (props.template ? props.template.code : toCode(form.name)))
const finalCode = computed(() => (form.code.trim() ? toCode(form.code) : codePreview.value))
const custom = computed(() => customVariables(form.subject, form.body))
const canSave = computed(() => !!form.name.trim() && !!finalCode.value && !!form.subject.trim() && !!form.body.trim() && form.defaultChannels.length > 0)

watch(open, (value) => {
  if (!value) return
  error.value = ''
  const t = props.template
  Object.assign(form, {
    name: t?.name ?? '',
    code: t?.code ?? '',
    description: t?.description ?? '',
    subject: t?.subject ?? '',
    body: t?.body ?? '',
    defaultChannels: t ? [...t.defaultChannels] : ['IN_APP']
  })
})

// Inserts at the message's caret (or appends when it was never focused).
function insertVariable(name: string) {
  const token = `{{${name}}}`
  const el = bodyInput.value?.textareaRef
  if (el && document.activeElement === el) {
    const start = el.selectionStart ?? form.body.length
    const end = el.selectionEnd ?? start
    form.body = form.body.slice(0, start) + token + form.body.slice(end)
    nextTick(() => el.setSelectionRange(start + token.length, start + token.length))
  } else {
    form.body = form.body + token
  }
}

async function onSubmit() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      name: form.name.trim(),
      code: finalCode.value,
      description: form.description.trim() || undefined,
      subject: form.subject.trim(),
      body: form.body,
      defaultChannels: form.defaultChannels
    }
    const saved = props.template ? await updateTemplate(props.template.id, payload) : await createTemplate(payload)
    toast.add({ title: props.template ? 'Template updated' : `${saved.name} created`, color: 'success' })
    open.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>
