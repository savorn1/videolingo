<template>
  <UTooltip text="Keyboard shortcuts (?)">
    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-keyboard" aria-label="Keyboard shortcuts" :class="buttonClass" @click="open = true" />
  </UTooltip>

  <UModal v-model:open="open" title="Keyboard shortcuts" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <dl class="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_1fr] md:gap-x-8 text-sm">
        <template v-for="s in items" :key="s.label">
          <dt class="flex flex-wrap items-center gap-1 border-b border-gray-100 py-2.5 pr-4 dark:border-gray-800/70">
            <UKbd v-for="(k, i) in s.keys.split(' ').filter(Boolean)" :key="i" :value="k" :class="keyTone(k)" />
          </dt>
          <dd class="border-b border-gray-100 py-2.5 text-gray-700 dark:border-gray-800/70 dark:text-gray-200">{{ s.label }}</dd>
        </template>
      </dl>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Soft tints by kind of key — no outlines, no legend — so the list stays calm but can be scanned by colour:
// arrows blue, modifiers violet (and a little back), letters green, space and the rest amber.
const ARROWS = new Set(['←', '→', '↑', '↓', '←→', '←→↑↓'])
const MODIFIERS = new Set(['shift', 'ctrl/⌘', 'ctrl', '⌘', 'alt', 'option'])
function keyTone(key: string): string {
  if (ARROWS.has(key)) return 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
  if (MODIFIERS.has(key.toLowerCase())) return 'bg-violet-50 text-violet-700 opacity-80 dark:bg-violet-950/60 dark:text-violet-300'
  if (/^[a-z?[\]]$/i.test(key)) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
  return 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
}

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
