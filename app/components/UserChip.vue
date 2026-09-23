<template>
  <span v-if="!name" class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
  <span v-else class="inline-flex items-center gap-1.5">
    <span class="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold leading-none shrink-0" :class="colorClasses">
      {{ initials }}
    </span>
    <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ name }}</span>
  </span>
</template>

<script setup lang="ts">
// A colored-initials chip for "assigned salesperson" columns — replaces
// plain-text usernames on the Leads table and kanban board. The
// color is deterministic (hashed from the name), so the same person always
// gets the same color across the app without needing a stored preference.
const props = defineProps<{ name: string | null | undefined }>()

const CHIP_COLOR_CLASSES = [
  'bg-sky-100 dark:bg-sky-400/20 text-sky-700 dark:text-sky-300',
  'bg-violet-100 dark:bg-violet-400/20 text-violet-700 dark:text-violet-300',
  'bg-teal-100 dark:bg-teal-400/20 text-teal-700 dark:text-teal-300',
  'bg-orange-100 dark:bg-orange-400/20 text-orange-700 dark:text-orange-300',
  'bg-emerald-100 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300',
  'bg-indigo-100 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-300',
  'bg-rose-100 dark:bg-rose-400/20 text-rose-700 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300'
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const initials = computed(() => {
  if (!props.name) return ''
  const parts = props.name.trim().split(/\s+/)
  return parts.length === 1 ? parts[0]!.slice(0, 2).toUpperCase() : (parts[0]![0]! + parts[1]![0]!).toUpperCase()
})

const colorClasses = computed(() => {
  if (!props.name) return CHIP_COLOR_CLASSES[0]
  return CHIP_COLOR_CLASSES[hashString(props.name) % CHIP_COLOR_CLASSES.length]
})
</script>
