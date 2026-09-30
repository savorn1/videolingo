<template>
  <div class="max-w-3xl space-y-6">
    <!-- Identity banner -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="overflow-hidden">
      <div class="h-20 bg-gradient-to-r from-primary-500/30 via-primary-400/10 to-transparent dark:from-primary-400/20" />
      <div class="px-5 pb-5 -mt-10 flex flex-wrap items-end gap-4">
        <div class="relative group rounded-full ring-4 ring-white dark:ring-gray-900">
          <UserAvatar :name="profile?.username" :src="avatar" size="3xl" />
          <button
            type="button"
            class="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
            :disabled="!profile"
            aria-label="Change profile photo"
            @click="fileInput?.click()"
          >
            <UIcon name="i-lucide-camera" class="w-5 h-5" />
          </button>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPickAvatar" />
        </div>
        <div class="min-w-0 flex-1 pb-1">
          <USkeleton v-if="!profile" class="h-7 w-40 mb-2" />
          <h1 v-else class="text-2xl font-bold text-gray-900 dark:text-white truncate">{{ profile.username }}</h1>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <USkeleton v-if="!profile" class="h-4 w-56" />
            <template v-else>
              <UBadge :color="profile.role === 'ADMIN' ? 'primary' : 'neutral'" variant="subtle">{{ profile.role }}</UBadge>
              <span v-if="profile.email" class="text-sm text-gray-500 dark:text-gray-400 inline-flex items-center gap-1 min-w-0">
                <UIcon name="i-lucide-mail" class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{{ profile.email }}</span>
              </span>
              <span v-else class="text-sm text-gray-400">No email set</span>
            </template>
          </div>
        </div>
        <div v-if="profile" class="flex gap-2 pb-1">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-camera" @click="fileInput?.click()">Change photo</UButton>
          <UButton v-if="avatar" size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="onRemoveAvatar">Remove</UButton>
        </div>
      </div>
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
    <UCard class="lg:col-span-2">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-user-round" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Account</h2>
        </div>
      </template>
      <DynamicForm v-model="profileForm" :fields="profileFields" :loading="savingProfile" :error="profileError" submit-label="Save" @submit="onSaveProfile" />
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-palette" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Preferences</h2>
        </div>
      </template>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Choose how tables look across the app.</p>
      <UTabs :model-value="theme" :items="tableStyleItems" :content="false" class="w-full" @update:model-value="(value) => setTheme(value as TableTheme)" />
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-shield-check" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Security</h2>
        </div>
      </template>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Change your password to keep your account secure.</p>
      <UButton color="neutral" variant="soft" icon="i-lucide-key-round" @click="showChangePassword = true"> Change password </UButton>
    </UCard>
    </div>

    <ChangePasswordModal v-model="showChangePassword" :loading="savingPassword" :error="passwordError" @submit="onChangePassword" />
  </div>
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'
import type { Profile } from '~/composables/useProfile'
import type { TableTheme } from '~/composables/useTableTheme'

const { getProfile, updateProfile, changePassword } = useProfile()
const { theme, setTheme } = useTableTheme()
const toast = useToast()

const profile = ref<Profile | null>(null)

const { avatar, load: loadAvatar, save: saveAvatar, clear: clearAvatar } = useAvatar()
const fileInput = ref<HTMLInputElement | null>(null)

async function onPickAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow picking the same file again
  if (!file || !profile.value) return
  try {
    await saveAvatar(profile.value.id, file)
    toast.add({ title: 'Profile photo updated', color: 'success' })
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : 'Could not update the photo', color: 'error' })
  }
}

function onRemoveAvatar() {
  if (!profile.value) return
  clearAvatar(profile.value.id)
  toast.add({ title: 'Profile photo removed', color: 'success' })
}

const tableStyleItems: { label: string; value: TableTheme; icon: string }[] = [
  { label: 'Plain', value: 'plain', icon: 'i-lucide-square' },
  { label: 'Striped', value: 'striped', icon: 'i-lucide-rows-3' },
  { label: 'Bordered', value: 'bordered', icon: 'i-lucide-table' }
]

const profileForm = ref<Record<string, any>>({})
const savingProfile = ref(false)
const profileError = ref('')

const showChangePassword = ref(false)
const savingPassword = ref(false)
const passwordError = ref('')

const profileFields: FieldDef[] = [{ name: 'email', type: 'email', hint: 'Used for password reset links.' }]

async function loadProfile() {
  profile.value = await getProfile()
  loadAvatar(profile.value.id)
  profileForm.value = { email: profile.value.email ?? '' }
}

async function onSaveProfile(values: Record<string, any>) {
  savingProfile.value = true
  profileError.value = ''
  try {
    profile.value = await updateProfile({ email: values.email || '' })
    toast.add({ title: 'Profile updated', color: 'success' })
  } catch (err) {
    profileError.value = apiErrorMessage(err)
  } finally {
    savingProfile.value = false
  }
}

async function onChangePassword(payload: { currentPassword: string; newPassword: string }) {
  savingPassword.value = true
  passwordError.value = ''
  try {
    await changePassword(payload)
    showChangePassword.value = false
    toast.add({ title: 'Password changed', color: 'success' })
  } catch (err) {
    passwordError.value = apiErrorMessage(err)
  } finally {
    savingPassword.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>
