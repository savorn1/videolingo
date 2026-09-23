<template>
  <div>
    <PageHeader :title="user?.username ?? 'User'" :crumbs="[{ label: 'Users', to: '/users' }, { label: user?.username ?? '…' }]">
      <template v-if="user && !isMe" #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-clapperboard" :to="`/videos?ownerId=${user.id}`">Videos</UButton>
        <UButton color="primary" variant="soft" icon="i-lucide-pencil" @click="openEdit">Edit</UButton>
        <UButton v-if="user.enabled" color="warning" variant="soft" icon="i-lucide-user-x" @click="confirmDisable = true">Disable</UButton>
        <UButton v-else color="success" variant="soft" icon="i-lucide-user-check" :loading="togglingStatus" @click="setStatus(true)">Enable</UButton>
        <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="soft" icon="i-lucide-ellipsis" aria-label="More actions" />
        </UDropdownMenu>
      </template>
      <template v-else-if="user && isMe" #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-clapperboard" :to="`/videos?ownerId=${user.id}`">Videos</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-user" to="/profile">Edit your profile</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/users">Back to users</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !user" :fields="6" :lines="false" />

    <div v-else-if="user" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UCard class="lg:col-span-1">
        <div class="flex flex-col items-center text-center">
          <UAvatar :alt="user.username" size="3xl" class="mb-3" />
          <p class="text-lg font-bold text-gray-900 dark:text-white">{{ user.username }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.email ?? 'No email on file' }}</p>
          <div class="flex flex-wrap justify-center gap-2 mt-3">
            <UBadge :color="user.role === 'ADMIN' ? 'primary' : 'neutral'" variant="subtle">{{ user.role === 'ADMIN' ? 'Admin' : 'User' }}</UBadge>
            <UBadge :color="user.enabled ? 'success' : 'warning'" variant="subtle">{{ user.enabled ? 'Enabled' : 'Disabled' }}</UBadge>
            <UBadge v-if="isMe" color="neutral" variant="outline">You</UBadge>
          </div>
        </div>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="font-semibold text-gray-900 dark:text-white">Account</h2>
        </template>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div v-for="item in details" :key="item.label">
            <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
            <dd class="mt-0.5 font-semibold text-gray-900 dark:text-white" :title="item.title">{{ item.value }}</dd>
          </div>
        </dl>
        <UAlert
          v-if="!user.email"
          class="mt-4"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="No email on file"
          description='This user can&apos;t use "forgot password" until an email is added.'
        />
      </UCard>

      <UCard class="lg:col-span-3">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-gray-900 dark:text-white">Permissions</h2>
            <span v-if="user.customRoleName" class="text-sm text-gray-500 dark:text-gray-400">via custom role “{{ user.customRoleName }}”</span>
          </div>
        </template>
        <p v-if="user.role === 'ADMIN'" class="text-sm text-gray-500 dark:text-gray-400">Admins have full access to every module.</p>
        <EmptyState
          v-else-if="!permissionsByModule.length"
          icon="i-lucide-shield-off"
          title="No permissions"
          description="Assign a custom role to let this user into the admin area."
        />
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="group in permissionsByModule" :key="group.module" class="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
            <p class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ humanize(group.module) }}</p>
            <div class="flex flex-wrap gap-1.5">
              <UBadge v-for="action in group.actions" :key="action" size="sm" color="neutral" variant="subtle">{{ formatEnum(action) }}</UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <ResetPasswordModal
      v-model="showResetPassword"
      :username="user?.username ?? ''"
      :loading="resettingPassword"
      :error="resetError"
      @submit="onResetPasswordSubmit"
    />

    <UModal v-model:open="showEdit" :title="`Edit user '${user?.username ?? ''}'`" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEditSubmit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      v-model="confirmDisable"
      title="Disable user"
      :description="`Disable '${user?.username ?? ''}'? They're signed out everywhere and can't sign in until re-enabled.`"
      confirm-label="Disable"
      color="warning"
      :loading="togglingStatus"
      @confirm="setStatus(false)"
    />
    <ConfirmModal
      v-model="confirmForceLogout"
      title="Force logout"
      :description="`Log out '${user?.username ?? ''}' everywhere? Their current session ends the next time it tries to refresh.`"
      confirm-label="Force logout"
      color="warning"
      :loading="forcingLogout"
      @confirm="onForceLogout"
    />
    <ConfirmModal
      v-model="confirmDelete"
      title="Delete user"
      :description="`Delete user '${user?.username ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FieldDef } from '#shared/types'
import { USER_ROLE_OPTIONS, type AdminUser } from '~/composables/useUsers'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { get, updateStatus, resetPassword, forceLogout, remove, applyEdits } = useUsers()
const { list: listCustomRoles } = useCustomRoles()
const { username: myUsername } = useAuth()

const id = computed(() => Number(route.params.id))
const user = ref<AdminUser | null>(null)
const loading = ref(false)
const error = ref('')

const isMe = computed(() => user.value?.username === myUsername.value)

async function load() {
  loading.value = true
  error.value = ''
  try {
    user.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const details = computed(() => {
  const u = user.value
  if (!u) return []
  return [
    { label: 'Username', value: u.username },
    { label: 'Email', value: u.email ?? '—' },
    { label: 'Role', value: u.role === 'ADMIN' ? 'Admin' : 'User' },
    { label: 'Custom role', value: u.role === 'ADMIN' ? 'Not applicable' : (u.customRoleName ?? 'None') },
    { label: 'Last login', value: u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : 'Never', title: formatDateTime(u.lastLoginAt) },
    { label: 'Created', value: formatDate(u.createdAt), title: formatDateTime(u.createdAt) }
  ]
})

const permissionsByModule = computed(() => {
  const groups = new Map<string, string[]>()
  for (const grant of user.value?.permissions ?? []) {
    groups.set(grant.module, [...(groups.get(grant.module) ?? []), grant.action])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([module, actions]) => ({ module, actions }))
})

const moreItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Send notification', icon: 'i-lucide-send', to: `/notifications/send?userId=${user.value?.id}` },
    { label: 'View notifications', icon: 'i-lucide-bell', to: `/notifications?recipientId=${user.value?.id}` }
  ],
  [
    { label: 'Reset password', icon: 'i-lucide-key-round', onSelect: () => openResetPassword() },
    { label: 'Force logout', icon: 'i-lucide-log-out', onSelect: () => (confirmForceLogout.value = true) }
  ],
  [{ label: 'Delete user', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => (confirmDelete.value = true) }]
])

// ── Edit ───────────────────────────────────────────────────────────────────
const customRoles = ref<{ id: number; name: string }[]>([])
const showEdit = ref(false)
const editing = ref(false)
const editError = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editForm = ref<Record<string, any>>({})

const editFields = computed<FieldDef[]>(() => [
  { name: 'email', type: 'email', icon: 'i-lucide-mail', wrapper: 'full' },
  { name: 'role', type: 'select', required: true, options: USER_ROLE_OPTIONS, hint: 'Changing role signs the user out.' },
  {
    name: 'customRoleId',
    label: 'Custom role',
    type: 'select',
    options: [{ label: 'None', value: undefined }, ...customRoles.value.map((r) => ({ label: r.name, value: r.id }))],
    hint: "Grants that role's per-module permissions.",
    showIf: (values) => values.role === 'USER'
  },
  { name: 'enabled', label: 'Status', type: 'switch', onLabel: 'Enabled', offLabel: 'Disabled', wrapper: 'full' }
])

async function openEdit() {
  if (!user.value) return
  editForm.value = { email: user.value.email ?? '', role: user.value.role, customRoleId: user.value.customRoleId ?? undefined, enabled: user.value.enabled }
  editError.value = ''
  showEdit.value = true
  if (!customRoles.value.length) {
    customRoles.value = await listCustomRoles({ size: 200 })
      .then((res) => res.data)
      .catch(() => [])
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onEditSubmit(values: Record<string, any>) {
  if (!user.value) return
  editing.value = true
  editError.value = ''
  try {
    await applyEdits(user.value, {
      email: values.email || undefined,
      role: values.role,
      customRoleId: values.role === 'USER' ? values.customRoleId || undefined : undefined,
      enabled: values.enabled
    })
    showEdit.value = false
    toast.add({ title: 'User updated', color: 'success' })
    // Re-fetch rather than trusting the last endpoint's response — applyEdits
    // may call several, and only a fresh GET carries the recomputed permissions.
    await load()
  } catch (err) {
    editError.value = apiErrorMessage(err)
  } finally {
    editing.value = false
  }
}

// ── Enable / disable ───────────────────────────────────────────────────────
const confirmDisable = ref(false)
const togglingStatus = ref(false)
async function setStatus(enabled: boolean) {
  if (!user.value) return
  togglingStatus.value = true
  try {
    user.value = { ...user.value, ...(await updateStatus(user.value.id, enabled)) }
    confirmDisable.value = false
    toast.add({ title: `User ${enabled ? 'enabled' : 'disabled'}`, color: 'success' })
  } catch (err) {
    toast.add({ title: `Could not ${enabled ? 'enable' : 'disable'} user`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    togglingStatus.value = false
  }
}

// ── Reset password ─────────────────────────────────────────────────────────
const showResetPassword = ref(false)
const resettingPassword = ref(false)
const resetError = ref('')
function openResetPassword() {
  resetError.value = ''
  showResetPassword.value = true
}
async function onResetPasswordSubmit(newPassword: string) {
  if (!user.value) return
  resettingPassword.value = true
  resetError.value = ''
  try {
    await resetPassword(user.value.id, newPassword)
    showResetPassword.value = false
    toast.add({ title: 'Password reset', description: `${user.value.username} has been signed out everywhere.`, color: 'success' })
  } catch (err) {
    resetError.value = apiErrorMessage(err)
  } finally {
    resettingPassword.value = false
  }
}

// ── Force logout / delete ──────────────────────────────────────────────────
const confirmForceLogout = ref(false)
const forcingLogout = ref(false)
async function onForceLogout() {
  if (!user.value) return
  forcingLogout.value = true
  try {
    await forceLogout(user.value.id)
    confirmForceLogout.value = false
    toast.add({ title: `${user.value.username} logged out`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not force logout', description: apiErrorMessage(err), color: 'error' })
  } finally {
    forcingLogout.value = false
  }
}

const confirmDelete = ref(false)
const deleting = ref(false)
async function onDelete() {
  if (!user.value) return
  deleting.value = true
  try {
    await remove(user.value.id)
    toast.add({ title: 'User deleted', color: 'success' })
    await navigateTo('/users')
  } catch (err) {
    toast.add({ title: 'Could not delete user', description: apiErrorMessage(err), color: 'error' })
    deleting.value = false
  }
}
</script>
