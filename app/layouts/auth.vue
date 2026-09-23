<template>
  <div class="min-h-screen flex bg-white dark:bg-gray-950">
    <!-- Branding panel — hidden below lg, where the form takes the full viewport -->
    <div
      class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-600 to-teal-700 text-white flex-col justify-between p-12"
    >
      <div class="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_15%,white,transparent_45%)]" />

      <NuxtLink to="/" class="relative flex items-center gap-2.5">
        <span class="flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 backdrop-blur">
          <UIcon name="i-lucide-languages" class="w-5 h-5" />
        </span>
        <span class="font-bold text-lg tracking-tight">VideoLingo</span>
      </NuxtLink>

      <div class="relative max-w-sm">
        <h1 class="text-4xl font-bold leading-tight mb-4">Learn languages through video</h1>
        <p class="text-lg font-medium text-white/90 mb-3">Subtitles, vocabulary, and progress — all in one place.</p>
      </div>

      <p class="relative text-xs text-white/60">&copy; {{ year }} VideoLingo</p>
    </div>

    <!-- Form panel -->
    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-sm">
        <div class="lg:hidden flex flex-col items-center text-center mb-8">
          <span class="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500 text-white mb-3 shadow-sm">
            <UIcon name="i-lucide-languages" class="w-6 h-6" />
          </span>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">VideoLingo</h1>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>
