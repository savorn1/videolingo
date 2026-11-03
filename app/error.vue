<template>
  <UApp>
    <div class="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
      <div class="w-full max-w-md space-y-5 text-center">
        <p class="text-sm font-semibold tabular-nums text-primary-600 dark:text-primary-400">{{ copy.code }}</p>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ copy.title }}</h1>
        <p class="text-gray-500 dark:text-gray-400">{{ copy.description }}</p>
        <nav v-if="suggestions.length" aria-label="Did you mean" class="space-y-1">
          <p class="text-sm text-muted">Did you mean</p>
          <ul class="flex flex-wrap justify-center gap-2">
            <li v-for="path in suggestions" :key="path">
              <UButton :label="path" color="neutral" variant="outline" size="sm" class="font-mono" @click="goTo(path)" />
            </li>
          </ul>
        </nav>
        <div class="flex flex-wrap justify-center gap-2">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="soft" @click="goBack">Go back</UButton>
          <UButton icon="i-lucide-house" @click="goHome">{{ signedIn ? 'Home' : 'Sign in' }}</UButton>
        </div>
        <!-- For whoever has to look into it -->
        <details v-if="detail" class="text-left text-xs text-gray-500 dark:text-gray-400">
          <summary class="cursor-pointer select-none text-center">Technical details</summary>
          <pre class="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-2 dark:bg-gray-900">{{ detail }}</pre>
        </details>
      </div>
    </div>
  </UApp>
</template>

<script setup lang="ts">
// Shown for a page that doesn't exist or that crashed, in place of Nuxt's plain default.
import type { NuxtError } from '#app'
import { errorCopy, nearbyPages } from '#shared/utils/errorPage'

const props = defineProps<{ error: NuxtError }>()
const { isAuthenticated } = useAuth()

const copy = computed(() => errorCopy(props.error?.statusCode))
const signedIn = computed(() => isAuthenticated.value)
// For a mistyped or old address, the app's own pages that share a word with it ("/new" → "/videos/new").
const route = useRoute()
const router = useRouter()
const suggestions = computed(() =>
  props.error?.statusCode === 404
    ? nearbyPages(
        route.fullPath,
        router.getRoutes().map((r) => r.path)
      )
    : []
)
const detail = computed(() => [props.error?.statusMessage, props.error?.message].filter((v, i, a) => v && a.indexOf(v) === i).join('\n'))
useHead({ title: () => `${copy.value.title} · VideoLingo` })

function goBack() {
  clearError()
  if (window.history.length > 1) window.history.back()
  else navigateTo('/')
}
function goTo(path: string) {
  clearError({ redirect: path })
}
function goHome() {
  clearError({ redirect: '/' })
}
</script>
