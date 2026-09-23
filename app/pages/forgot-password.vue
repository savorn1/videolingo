<template>
  <div>
    <template v-if="!sent">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Forgot your password?</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">Enter the email on your account and we'll send you a link to reset it.</p>

      <UForm :state="form" class="space-y-4" @submit="onSubmit">
        <UInput
          v-model="form.email"
          type="email"
          placeholder="Email"
          icon="i-lucide-mail"
          size="lg"
          autocomplete="email"
          autofocus
          required
          aria-label="Email"
          class="w-full"
        />

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

        <UButton type="submit" block size="lg" :loading="loading">Send reset link</UButton>
      </UForm>
    </template>

    <!-- Same message whether or not the email matched an account — the
         backend deliberately doesn't say, so neither does this page. -->
    <template v-else>
      <span class="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400 mb-4">
        <UIcon name="i-lucide-mail-check" class="w-6 h-6" />
      </span>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Check your email</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
        If an account exists for <span class="font-semibold text-gray-700 dark:text-gray-200">{{ form.email }}</span
        >, we've sent a link to reset its password. The link expires shortly and works once.
      </p>
      <UButton block size="lg" color="neutral" variant="soft" :loading="loading" @click="onSubmit">Send again</UButton>
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

const { forgotPassword } = useAuth()

const form = reactive({ email: '' })
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await forgotPassword(form.email.trim())
    sent.value = true
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>
