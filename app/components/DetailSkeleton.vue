<template>
  <!-- Detail pages previously showed a single grey "Loading…" line in an empty
       page, then snapped the whole form in at once. List pages already render a
       shaped skeleton (see DataTable), so this brings record pages up to the
       same standard and removes the layout jump.

       Deliberately approximate: it mirrors the common detail-page shape — a card
       of form fields, then a card of line items — rather than trying to match any
       one page exactly. -->
  <div class="space-y-6" role="status" aria-label="Loading">
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <USkeleton class="h-4 w-32" />
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="i in fields" :key="i" class="space-y-2">
          <USkeleton class="h-3 w-20" />
          <USkeleton class="h-8 w-full" />
        </div>
      </div>
    </div>

    <div v-if="lines" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <USkeleton class="h-4 w-24" />
      <div v-for="i in 3" :key="i" class="flex items-center gap-4">
        <USkeleton class="h-8 w-1/3" />
        <USkeleton class="h-8 flex-1" />
        <USkeleton class="h-8 w-24" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Field placeholders in the first card — roughly match the real form's density. */
    fields?: number
    /** Show a second card standing in for a line-items table. */
    lines?: boolean
  }>(),
  { fields: 6, lines: true }
)
</script>
