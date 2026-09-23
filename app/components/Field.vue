<template>
  <!-- hidden fields render nothing; their value just rides along in the model -->
  <UFormField v-if="field.type !== 'hidden'" :label="label" :name="field.name" :required="field.required">
    <template v-if="field.hint" #label="{ label: labelText }">
      <span class="inline-flex items-center gap-1">
        {{ labelText }}
        <UTooltip :text="field.hint" :delay-duration="150">
          <UIcon name="i-lucide-info" class="size-3.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
        </UTooltip>
      </span>
    </template>
    <component :is="control" v-model="model" :field="field" />
  </UFormField>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { FieldDef, FieldType } from '#shared/types'
import FieldText from './fields/FieldText.vue'
import FieldEmail from './fields/FieldEmail.vue'
import FieldPassword from './fields/FieldPassword.vue'
import FieldUrl from './fields/FieldUrl.vue'
import FieldNumber from './fields/FieldNumber.vue'
import FieldCurrency from './fields/FieldCurrency.vue'
import FieldTextarea from './fields/FieldTextarea.vue'
import FieldSelect from './fields/FieldSelect.vue'
import FieldCombobox from './fields/FieldCombobox.vue'
import FieldRadio from './fields/FieldRadio.vue'
import FieldCheckbox from './fields/FieldCheckbox.vue'
import FieldSwitch from './fields/FieldSwitch.vue'
import FieldDate from './fields/FieldDate.vue'
import FieldDateTime from './fields/FieldDateTime.vue'

const props = defineProps<{ field: FieldDef }>()

const model = defineModel<unknown>()

const CONTROLS: Record<Exclude<FieldType, 'hidden'>, Component> = {
  text: FieldText,
  email: FieldEmail,
  password: FieldPassword,
  url: FieldUrl,
  number: FieldNumber,
  currency: FieldCurrency,
  textarea: FieldTextarea,
  select: FieldSelect,
  combobox: FieldCombobox,
  radio: FieldRadio,
  checkbox: FieldCheckbox,
  switch: FieldSwitch,
  date: FieldDate,
  datetime: FieldDateTime
}

const control = computed(() => CONTROLS[(props.field.type ?? 'text') as Exclude<FieldType, 'hidden'>])
const label = computed(() => props.field.label ?? humanize(props.field.name))
</script>
