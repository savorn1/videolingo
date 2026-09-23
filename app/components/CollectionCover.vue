<template>
  <div class="relative aspect-video overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-950 dark:to-primary-900">
    <img v-if="src && !broken" :src="src" alt="" class="w-full h-full object-cover" loading="lazy" @error="broken = true" />
    <UIcon v-else name="i-lucide-library" class="absolute inset-0 m-auto w-8 h-8 text-primary-400/70" />
    <slot />
  </div>
</template>

<script setup lang="ts">
// Cover image with a placeholder for missing or broken URLs.
const props = defineProps<{ src: string | null | undefined }>()
const broken = ref(false)
watch(
  () => props.src,
  () => (broken.value = false)
)
</script>
