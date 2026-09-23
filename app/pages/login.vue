<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">Sign in to your account to continue</p>

    <UForm :state="form" class="space-y-4" @submit="onSubmit">
      <UInput
        v-model="form.username"
        placeholder="Username"
        icon="i-lucide-user"
        size="lg"
        autocomplete="username"
        autofocus
        required
        aria-label="Username"
        class="w-full"
      />
      <UInput
        v-model="form.password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="Password"
        icon="i-lucide-lock"
        size="lg"
        autocomplete="current-password"
        required
        aria-label="Password"
        class="w-full"
      >
        <template #trailing>
          <UButton
            color="neutral"
            variant="link"
            :padded="false"
            :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          />
        </template>
      </UInput>

      <div class="flex justify-end -mt-2">
        <NuxtLink to="/forgot-password" class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"> Forgot password? </NuxtLink>
      </div>

      <UAlert
        v-if="passwordReset"
        color="success"
        variant="subtle"
        title="Password updated"
        description="Sign in with your new password."
        icon="i-lucide-circle-check"
      />

      <UAlert
        v-if="sessionExpired"
        color="warning"
        variant="subtle"
        title="Your session expired"
        description="Sign in again and we'll take you back to what you were doing."
        icon="i-lucide-clock"
      />

      <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

      <UButton type="submit" block size="lg" :loading="loading">Sign in</UButton>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import type { LoginRequest } from '~/composables/useAuth'

definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const route = useRoute()

const sessionExpired = computed(() => route.query.reason === 'expired')
const passwordReset = computed(() => route.query.reset === '1')

// Only ever return to an internal path. A `redirect` of "//evil.com" or
// "https://evil.com" would otherwise turn the login form into an open redirect.
const redirectTarget = computed(() => {
  const target = route.query.redirect
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return '/'
  }
  return target
})
const form = reactive<LoginRequest>({ username: '', password: '' })
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await login(form)
    await navigateTo(redirectTarget.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>
