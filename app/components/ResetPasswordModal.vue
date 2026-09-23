<template>
  <UModal v-model:open="open" :title="`Reset password for '${username}'`">
    <template #body>
      <DynamicForm
        v-model="form"
        :fields="fields"
        :loading="loading"
        :error="displayError"
        submit-label="Reset password"
        cancelable
        @submit="onSubmit"
        @cancel="open = false"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

const open = defineModel<boolean>({ default: false })

const props = defineProps<{ username: string; loading?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [newPassword: string] }>()

const form = ref<Record<string, any>>({})
const mismatchError = ref('')

const fields: FieldDef[] = [
  { name: 'newPassword', label: 'New password', type: 'password', required: true, hint: 'Minimum 6 characters.' },
  { name: 'confirmNewPassword', label: 'Confirm new password', type: 'password', required: true }
]

const displayError = computed(() => mismatchError.value || props.error)

// Reset the form (and any leftover error state carried by v-model) each time
// the modal is reopened, so a previous target's typed password never leaks
// into the next one.
watch(open, (value) => {
  if (value) {
    form.value = {}
    mismatchError.value = ''
  }
})

function onSubmit(values: Record<string, any>) {
  if (values.newPassword !== values.confirmNewPassword) {
    mismatchError.value = "New password and confirmation don't match"
    return
  }
  mismatchError.value = ''
  emit('submit', values.newPassword)
}
</script>
