<template>
  <!-- Rendered once by the default layout. Any page using useUnsavedChangesGuard
       routes its "you're about to lose changes" prompt through here, so the
       confirmation looks the same everywhere instead of the browser's own. -->
  <ConfirmModal
    :model-value="prompt !== null"
    title="Discard changes?"
    description="You have unsaved changes on this page. Leaving now will discard them."
    confirm-label="Discard"
    color="error"
    @update:model-value="
      (open: boolean) => {
        if (!open) stay()
      }
    "
    @confirm="leave"
  />
</template>

<script setup lang="ts">
const prompt = useUnsavedChangesPrompt()

function leave() {
  prompt.value?.resolve(true)
  prompt.value = null
}

// Dismissing the dialog means "keep editing" — the navigation is cancelled.
function stay() {
  prompt.value?.resolve(false)
  prompt.value = null
}
</script>
