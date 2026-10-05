<template>
  <div aria-live="polite">
    <div
      v-if="!online"
      class="mb-4 flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-100"
      role="status"
      data-testid="offline-banner"
    >
      <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0 text-warning-600 dark:text-warning-400" />
      <span><strong>You're offline.</strong> Changes can't be saved and lists won't update until the connection is back.</span>
    </div>
    <div
      v-else-if="backOnline"
      class="mb-4 flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-900 dark:border-success-900 dark:bg-success-950/40 dark:text-success-100"
      role="status"
    >
      <UIcon name="i-lucide-wifi" class="size-4 shrink-0 text-success-600 dark:text-success-400" />
      Back online.
    </div>
  </div>
</template>

<script setup lang="ts">
// Says so when the browser loses its connection (every request would fail
// otherwise, each with its own error), and briefly when it comes back. Pages that
// poll (usePolling) pause while offline and refresh by themselves on return.
const online = ref(true)
const backOnline = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | undefined

function update() {
  const now = navigator.onLine
  if (now && !online.value) {
    backOnline.value = true
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => (backOnline.value = false), 4000)
  }
  online.value = now
}

onMounted(() => {
  online.value = navigator.onLine
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})
onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})
</script>
