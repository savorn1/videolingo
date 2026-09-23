<template>
  <div>
    <PageHeader title="Users" description="Accounts that can sign in to VideoLingo.">
      <template #actions>
        <UButton icon="i-lucide-plus" @click="openCreate">New user</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search username or email" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.role" :items="roleFilterOptions" placeholder="Role" class="w-36" />
        <USelect v-model="filter.enabled" :items="statusFilterOptions" placeholder="Status" class="w-36" />
        <USelect v-model="filter.customRoleId" :items="customRoleFilterOptions" placeholder="Custom role" class="w-44" />
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        v-model:selected="selectedUsers"
        :rows="rows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        selectable
        exportable
        export-filename="users"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row: AdminUser) => navigateTo(`/users/${row.id}`)"
      >
        <template #bulk-actions="{ selected, clear }">
          <UButton size="xs" color="warning" variant="soft" icon="i-lucide-log-out" @click="onBulkForceLogoutClick(selected, clear)">Force logout</UButton>
        </template>

        <template #username-data="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar :alt="row.username" size="xs" />
            <span class="font-semibold">{{ row.username }}</span>
            <UBadge v-if="row.username === myUsername" size="sm" color="neutral" variant="subtle">You</UBadge>
          </div>
        </template>

        <template #actions-data="{ row }">
          <div class="min-w-max" @click.stop>
            <RowActions :actions="rowActions(row)" :max="2" />
          </div>
        </template>

        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No users match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-users" title="No users yet" description="Create the first user account to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New user</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <ResetPasswordModal
      v-model="showResetPassword"
      :username="resetTarget?.username ?? ''"
      :loading="resettingPassword"
      :error="resetError"
      @submit="onResetPasswordSubmit"
    />

    <UModal v-model:open="showCreate" title="New user" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="createFields"
          :loading="creating"
          :error="createError"
          submit-label="Create"
          cancelable
          @submit="onCreateSubmit"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showEdit" :title="`Edit user '${editingUser?.username ?? ''}'`" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete user"
      :description="`Delete user '${confirmDelete?.username ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => !v && (confirmDelete = null)"
      @confirm="onDelete"
    />

    <ConfirmModal
      :model-value="confirmDisable !== null"
      title="Disable user"
      :description="`Disable '${confirmDisable?.username ?? ''}'? They're signed out everywhere and can't sign in until re-enabled.`"
      confirm-label="Disable"
      color="warning"
      :loading="togglingStatus"
      @update:model-value="(v: boolean) => !v && (confirmDisable = null)"
      @confirm="confirmDisable && setStatus(confirmDisable, false)"
    />

    <ConfirmModal
      :model-value="confirmForceLogout !== null"
      title="Force logout"
      :description="`Log out '${confirmForceLogout?.username ?? ''}' everywhere? Their current session ends the next time it tries to refresh.`"
      confirm-label="Force logout"
      color="warning"
      :loading="forcingLogout"
      @update:model-value="(v: boolean) => !v && (confirmForceLogout = null)"
      @confirm="onForceLogoutConfirm"
    />

    <ConfirmModal
      :model-value="bulkForceLogoutTargets !== null"
      title="Force logout"
      :description="`Log out ${bulkForceLogoutTargets?.length ?? 0} selected user(s) everywhere? Their current sessions end the next time they try to refresh.`"
      confirm-label="Force logout"
      color="warning"
      :loading="forcingBulkLogout"
      @update:model-value="(v: boolean) => !v && (bulkForceLogoutTargets = null)"
      @confirm="onBulkForceLogoutConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import { USER_ROLE_OPTIONS, type AdminUser, type CreateUserPayload, type Role, type UserEditPayload } from '~/composables/useUsers'

definePageMeta({ middleware: 'admin' })

const { list, create, remove, updateStatus, resetPassword, forceLogout, bulkForceLogout, applyEdits } = useUsers()
const { list: listCustomRoles } = useCustomRoles()
const { username: myUsername } = useAuth()
const toast = useToast()

const rows = ref<AdminUser[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

// ── Lookups ────────────────────────────────────────────────────────────────
const customRoles = ref<{ id: number; name: string }[]>([])
async function loadCustomRoles() {
  try {
    customRoles.value = (await listCustomRoles({ size: 200 })).data
  } catch {
    // Non-fatal: the custom-role select/filter just stays empty.
    customRoles.value = []
  }
}
const customRoleOptions = computed(() => [{ label: 'None', value: undefined }, ...customRoles.value.map((r) => ({ label: r.name, value: r.id }))])
const customRoleFilterOptions = computed(() => [
  { label: 'All custom roles', value: undefined },
  ...customRoles.value.map((r) => ({ label: r.name, value: r.id }))
])

// ── List state (server-side search, filter, sort and paging) ───────────────
const filter = reactive<{ role: Role | undefined; enabled: boolean | undefined; customRoleId: number | undefined }>({
  role: undefined,
  enabled: undefined,
  customRoleId: undefined
})
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'id', direction: 'desc' })

useListQuerySync({ filter, search, page })

const roleFilterOptions = [{ label: 'All roles', value: undefined }, ...USER_ROLE_OPTIONS]
const statusFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false }
]

const columns: ColumnDef<AdminUser>[] = [
  { key: 'username', sortable: true },
  { key: 'email', sortable: true, value: (row) => row.email ?? '—' },
  { key: 'role', type: 'badge', sortable: true, color: (row) => (row.role === 'ADMIN' ? 'primary' : 'neutral') },
  { key: 'customRoleName', label: 'Custom role', value: (row) => row.customRoleName ?? '—' },
  { key: 'enabled', label: 'Status', type: 'boolean', sortable: true, trueLabel: 'Enabled', falseLabel: 'Disabled', falseColor: 'warning' },
  { key: 'lastLoginAt', label: 'Last login', type: 'datetime', sortable: true },
  { key: 'createdAt', label: 'Created', type: 'date', sortable: true },
  { key: 'actions', label: '' }
]

// Guards against an older, slower response landing after a newer one (fast
// typing in the search box) and overwriting it.
let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      role: filter.role,
      enabled: filter.enabled,
      customRoleId: filter.customRoleId,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      page: page.value,
      size: pageSize.value
    })
    if (seq !== requestSeq) return
    rows.value = res.data
    total.value = res.metadata.totalCount
  } catch (err) {
    if (seq === requestSeq) error.value = apiErrorMessage(err)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

// Search is debounced so each keystroke doesn't fire a request.
const debouncedSearch = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (debouncedSearch.value = value), 300)
})

// Declared before the load watcher on purpose: any change that alters the
// result set sends the user back to page 1, and because both watchers flush in
// the same tick the load below runs once, with page already reset.
watch([() => ({ ...filter }), debouncedSearch, sort, pageSize], () => {
  page.value = 1
})
watch([() => ({ ...filter }), debouncedSearch, sort, page, pageSize], load)

const hasActiveFilter = computed(() => search.value !== '' || filter.role !== undefined || filter.enabled !== undefined || filter.customRoleId !== undefined)

function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.role = undefined
  filter.enabled = undefined
  filter.customRoleId = undefined
}

onMounted(() => {
  loadCustomRoles()
  load()
})

// ── Row actions ────────────────────────────────────────────────────────────
function rowActions(row: AdminUser): RowAction[] {
  const isMe = row.username === myUsername.value
  const actions: RowAction[] = [{ label: 'View', icon: 'i-lucide-eye', onClick: () => navigateTo(`/users/${row.id}`) }]
  if (isMe) return actions
  actions.push(
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openEdit(row) },
    row.enabled
      ? { label: 'Disable', icon: 'i-lucide-user-x', color: 'warning', onClick: () => (confirmDisable.value = row) }
      : { label: 'Enable', icon: 'i-lucide-user-check', color: 'success', loading: togglingStatus.value, onClick: () => setStatus(row, true) },
    { label: 'Reset password', icon: 'i-lucide-key-round', onClick: () => openResetPasswordWith(row) },
    { label: 'Force logout', icon: 'i-lucide-log-out', onClick: () => (confirmForceLogout.value = row) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  )
  return actions
}

// ── Enable / disable ───────────────────────────────────────────────────────
const confirmDisable = ref<AdminUser | null>(null)
const togglingStatus = ref(false)
async function setStatus(row: AdminUser, enabled: boolean) {
  togglingStatus.value = true
  try {
    await updateStatus(row.id, enabled)
    toast.add({ title: `${row.username} ${enabled ? 'enabled' : 'disabled'}`, color: 'success' })
    confirmDisable.value = null
    await load()
  } catch (err) {
    toast.add({ title: `Could not ${enabled ? 'enable' : 'disable'} user`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    togglingStatus.value = false
  }
}

// ── Reset password ─────────────────────────────────────────────────────────
const {
  open: showResetPassword,
  target: resetTarget,
  loading: resettingPassword,
  error: resetError,
  openWith: openResetPasswordWith
} = useTargetModal<AdminUser>()

async function onResetPasswordSubmit(newPassword: string) {
  if (!resetTarget.value) return
  resettingPassword.value = true
  resetError.value = ''
  try {
    await resetPassword(resetTarget.value.id, newPassword)
    showResetPassword.value = false
    toast.add({ title: 'Password reset', description: `${resetTarget.value.username} has been signed out everywhere.`, color: 'success' })
  } catch (err) {
    resetError.value = apiErrorMessage(err)
  } finally {
    resettingPassword.value = false
  }
}

// ── Create / edit / delete ─────────────────────────────────────────────────
const customRoleField = computed<FieldDef>(() => ({
  name: 'customRoleId',
  label: 'Custom role',
  type: 'select',
  options: customRoleOptions.value,
  hint: "Only used when Role is User — grants that role's per-module permissions.",
  showIf: (values) => values.role === 'USER'
}))

const createFields = computed<FieldDef[]>(() => [
  { name: 'username', required: true, icon: 'i-lucide-user' },
  { name: 'email', type: 'email', icon: 'i-lucide-mail', hint: 'Optional — needed for "forgot password".' },
  { name: 'password', type: 'password', required: true, hint: 'Minimum 6 characters.' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', required: true },
  { name: 'role', type: 'select', required: true, options: USER_ROLE_OPTIONS },
  customRoleField.value,
  { name: 'enabled', label: 'Status', type: 'switch', onLabel: 'Enabled', offLabel: 'Disabled', default: true, wrapper: 'full' }
])

const editFields = computed<FieldDef[]>(() => [
  { name: 'email', type: 'email', icon: 'i-lucide-mail', wrapper: 'full' },
  { name: 'role', type: 'select', required: true, options: USER_ROLE_OPTIONS, hint: 'Changing role signs the user out.' },
  customRoleField.value,
  { name: 'enabled', label: 'Status', type: 'switch', onLabel: 'Enabled', offLabel: 'Disabled', wrapper: 'full' }
])

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate,
  onCreate,
  showEdit,
  editing,
  editError,
  editingRow: editingUser,
  editForm,
  openEdit,
  onEdit,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<AdminUser, CreateUserPayload, UserEditPayload>(
  {
    create: (payload) => create(payload),
    remove: (row) => remove(row.id),
    update: (row, payload) => applyEdits(row, payload)
  },
  load,
  {
    entityName: 'User',
    createDefaults: () => ({ role: 'USER', enabled: true }),
    toPayload: (values) => ({
      username: values.username?.trim(),
      password: values.password,
      email: values.email || undefined,
      role: values.role,
      customRoleId: values.role === 'USER' ? values.customRoleId || undefined : undefined,
      enabled: values.enabled ?? true
    }),
    toForm: (row) => ({
      email: row.email ?? '',
      role: row.role,
      customRoleId: row.customRoleId ?? undefined,
      enabled: row.enabled
    }),
    toEditPayload: (values) => ({
      email: values.email || undefined,
      role: values.role,
      customRoleId: values.role === 'USER' ? values.customRoleId || undefined : undefined,
      enabled: values.enabled
    }),
    onCreated: async (created) => {
      await navigateTo(`/users/${created.id}`)
    }
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onCreateSubmit(values: Record<string, any>) {
  if (values.password !== values.confirmPassword) {
    createError.value = "Password and confirmation don't match"
    return
  }
  onCreate(values)
}

// ── Force logout ───────────────────────────────────────────────────────────
const selectedUsers = ref<AdminUser[]>([])

const confirmForceLogout = ref<AdminUser | null>(null)
const forcingLogout = ref(false)
async function onForceLogoutConfirm() {
  if (!confirmForceLogout.value) return
  forcingLogout.value = true
  try {
    await forceLogout(confirmForceLogout.value.id)
    toast.add({ title: `${confirmForceLogout.value.username} logged out`, color: 'success' })
    confirmForceLogout.value = null
  } catch (err) {
    toast.add({ title: 'Could not force logout', description: apiErrorMessage(err), color: 'error' })
  } finally {
    forcingLogout.value = false
  }
}

const bulkForceLogoutTargets = ref<AdminUser[] | null>(null)
const forcingBulkLogout = ref(false)
let clearSelection: (() => void) | null = null
function onBulkForceLogoutClick(selected: AdminUser[], clear: () => void) {
  bulkForceLogoutTargets.value = selected
  clearSelection = clear
}
async function onBulkForceLogoutConfirm() {
  if (!bulkForceLogoutTargets.value) return
  forcingBulkLogout.value = true
  try {
    await bulkForceLogout(bulkForceLogoutTargets.value.map((u) => u.id))
    toast.add({ title: `${bulkForceLogoutTargets.value.length} user(s) logged out`, color: 'success' })
    bulkForceLogoutTargets.value = null
    clearSelection?.()
    selectedUsers.value = []
  } catch (err) {
    toast.add({ title: 'Could not force logout selected users', description: apiErrorMessage(err), color: 'error' })
  } finally {
    forcingBulkLogout.value = false
  }
}
</script>
