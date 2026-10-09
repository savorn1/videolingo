<template>
  <div
    v-if="!online"
    class="flex items-center gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-800 sm:px-6 dark:border-warning-900 dark:bg-warning-950/80 dark:text-warning-200"
    role="status"
    data-testid="offline-banner"
  >
    <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" />
    <span>You're offline. Saving, uploads and new jobs will fail until the connection is back — what's on screen stays as it is.</span>
  </div>
</template>

<script setup lang="ts">
// Says so while the browser has no connection (every action here needs the server), and when it comes back.
const toast = useToast()
const online = ref(true)
function update() {
  const was = online.value
  online.value = navigator.onLine
  if (!was && online.value) toast.add({ title: 'Back online', icon: 'i-lucide-wifi', color: 'success' })
}
onMounted(() => {
  online.value = navigator.onLine
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})
</script>
