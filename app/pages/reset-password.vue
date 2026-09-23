<template>
  <div>
    <template v-if="token">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Choose a new password</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">You'll be signed out everywhere else once it's changed.</p>

      <UForm :state="form" class="space-y-4" @submit="onSubmit">
        <UInput
          v-model="form.newPassword"
          :type="showPassword ? 'text' : 'password'"
          placeholder="New password"
          icon="i-lucide-lock"
          size="lg"
          autocomplete="new-password"
          autofocus
          required
          :minlength="MIN_LENGTH"
          aria-label="New password"
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
        <UInput
          v-model="form.confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Confirm new password"
          icon="i-lucide-lock"
          size="lg"
          autocomplete="new-password"
          required
          aria-label="Confirm new password"
          class="w-full"
        />

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert">
          <template v-if="linkDead" #description>
            <NuxtLink to="/forgot-password" class="font-semibold underline">Request a new link</NuxtLink>
          </template>
        </UAlert>

        <UButton type="submit" block size="lg" :loading="loading">Reset password</UButton>
      </UForm>
    </template>

    <template v-else>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Link incomplete</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
        This reset link is missing its token. Open the link from your email again, or request a new one.
      </p>
      <UButton to="/forgot-password" block size="lg">Request a new link</UButton>
    </template>

    <p class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
      <NuxtLink to="/login" class="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        Back to sign in
      </NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

// Matches ResetPasswordWithTokenRequest's @Size(min = 6) on the backend.
const MIN_LENGTH = 6

const { resetPassword } = useAuth()
const route = useRoute()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const form = reactive({ newPassword: '', confirmPassword: '' })
const loading = ref(false)
const error = ref('')
// The token was rejected (expired, already used, or superseded by a newer
// email) — retrying with another password can't help, so point at a new link.
const linkDead = ref(false)
const showPassword = ref(false)

async function onSubmit() {
  error.value = ''
  linkDead.value = false
  if (form.newPassword.length < MIN_LENGTH) {
    error.value = `Password must be at least ${MIN_LENGTH} characters`
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }
  loading.value = true
  try {
    await resetPassword(token.value, form.newPassword)
    await navigateTo({ path: '/login', query: { reset: '1' } })
  } catch (err) {
    error.value = apiErrorMessage(err)
    linkDead.value = (err as { data?: { errors?: unknown } })?.data?.errors === undefined
  } finally {
    loading.value = false
  }
}
</script>
