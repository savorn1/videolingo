<template>
  <template v-if="column.type === 'status'">
    <StatusBadge v-if="rawValue !== null && rawValue !== undefined" :status="String(rawValue)" />
    <span v-else class="text-gray-500 dark:text-gray-400">—</span>
  </template>
  <template v-else-if="column.type === 'link'">
    <NuxtLink :to="column.href!(row)" class="text-primary-500 font-medium" @click.stop>{{ text }}</NuxtLink>
  </template>
  <template v-else-if="column.type === 'boolean'">
    <UBadge v-if="rawValue || column.falseLabel !== ''" :color="boolColor" variant="subtle">
      {{ rawValue ? (column.trueLabel ?? 'Yes') : (column.falseLabel ?? 'No') }}
    </UBadge>
  </template>
  <template v-else-if="column.type === 'badge'">
    <UBadge :color="badgeColor" variant="subtle">{{ text }}</UBadge>
  </template>
  <template v-else
    ><span class="block truncate" :title="text">{{ text }}</span></template
  >
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'

const props = defineProps<{ column: ColumnDef; row: Record<string, any> }>()

const rawValue = computed(() => (props.column.value ? props.column.value(props.row) : props.row[props.column.key]))

const text = computed(() => formatColumnText(props.column, props.row))
const boolColor = computed<any>(() => (rawValue.value ? (props.column.trueColor ?? 'success') : (props.column.falseColor ?? 'neutral')))

const badgeColor = computed<any>(() => {
  const c = props.column
  return typeof c.color === 'function' ? c.color(props.row) : (c.color ?? 'neutral')
})
</script>
