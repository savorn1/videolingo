<template>
  <UTooltip text="Keyboard shortcuts (?)">
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-keyboard"
      aria-label="Keyboard shortcuts"
      :class="buttonClass"
      @click="open = true"
    />
  </UTooltip>

  <UModal v-model:open="open" title="Keyboard shortcuts" :ui="{ content: 'sm:max-w-sm' }">
    <template #body>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <template v-for="s in items" :key="s.label">
          <dt class="flex items-center gap-1 flex-wrap">
            <UKbd v-for="(k, i) in s.keys.split(' ')" :key="i" :value="k" />
          </dt>
          <dd class="text-gray-600 dark:text-gray-300">{{ s.label }}</dd>
        </template>
      </dl>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// A consistent "press ? for shortcuts" pattern: a small keyboard-icon button
// (for anyone who doesn't know to press ?) plus the key itself, both opening
// the same list. Each area (the editor, the watch page…) mounts one of
// these with its own `items`, so the trigger and the look are always the
// same even though the shortcuts themselves differ.
// `enabled` is boolean-typed, so Vue casts an absent prop to `false`, not
// `undefined` (its normal "was this attribute given at all" default doesn't
// apply to booleans) — withDefaults is what makes "not passed" mean `true`
// here instead of silently disabling the "?" key on every page that doesn't
// pass the prop explicitly.
const props = withDefaults(
  defineProps<{
    items: { keys: string; label: string }[]
    /** Extra classes for the trigger button — e.g. to tuck it into an existing toolbar. */
    buttonClass?: string
    /** false when a modal/input elsewhere should keep the "?" key (rare — most pages can leave this on). */
    enabled?: boolean
  }>(),
  { enabled: true }
)

const open = ref(false)

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}
function onKeyDown(e: KeyboardEvent) {
  if (!props.enabled) return
  if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
  e.preventDefault()
  open.value = true
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>
