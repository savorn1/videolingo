<template>
  <span v-if="!name" class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
  <span v-else class="inline-flex items-center gap-1.5">
    <UserAvatar :name="name" size="2xs" />
    <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ name }}</span>
  </span>
</template>

<script setup lang="ts">
// A colored-initials chip for "assigned salesperson" columns — replaces
// plain-text usernames on the Leads table and kanban board.
defineProps<{ name: string | null | undefined }>()
</script>
