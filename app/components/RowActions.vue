<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-for="action in visible"
      :key="action.label"
      size="xs"
      :color="action.color ?? 'neutral'"
      variant="soft"
      :class="action.tone && !action.color ? ACTION_TONES[action.tone].button : ''"
      :icon="action.icon"
      :loading="action.loading"
      @click.stop="action.onClick"
    >
      {{ action.label }}
    </UButton>

    <UDropdownMenu v-if="overflow.length > 0" :items="[overflowItems]" :content="{ align: 'end' }">
      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-ellipsis" aria-label="More actions" @click.stop />
    </UDropdownMenu>
  </div>
</template>

<script setup lang="ts">
import type { RowAction } from '#shared/types'
import { ACTION_TONES } from '#shared/utils/actionTone'

// First `max` actions render as buttons; the rest collapse into a "…" menu —
// keeps a row from growing a wall of buttons as more per-row actions get
// added over time (see leases/properties, which each split a single "Manage"
// button into several focused ones).
const props = withDefaults(defineProps<{ actions: RowAction[]; max?: number }>(), { max: 4 })

const visible = computed(() => props.actions.slice(0, props.max))
const overflow = computed(() => props.actions.slice(props.max))
// In the "…" menu the icon takes the action's colour (a danger action also turns its label red).
const overflowItems = computed(() =>
  overflow.value.map((a) => ({
    label: a.label,
    icon: a.icon,
    onSelect: a.onClick,
    ...(a.color === 'error' ? { color: 'error' as const } : {}),
    ...(a.tone ? { ui: { itemLeadingIcon: ACTION_TONES[a.tone].icon } } : {})
  }))
)
</script>
