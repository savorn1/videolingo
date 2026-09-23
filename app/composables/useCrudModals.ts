// Drives the create/edit/delete modal trio for a list page: form state, loading
// flags, and API calls, so pages only supply the actions and field mapping.
// Not every backend endpoint exposes a generic update (e.g. users only have
// specialized /role, /status, /password endpoints) or even a delete at all
// (e.g. leases, buyers) — both `update` and `remove` are optional, and pages
// that don't pass one simply never call its open*/on* pair.
export function useCrudModals<TResponse, TRequest = Record<string, any>, TEditRequest = TRequest>(
  actions: {
    create: (payload: TRequest) => Promise<TResponse>
    remove?: (row: TResponse) => Promise<void>
    update?: (row: TResponse, payload: TEditRequest) => Promise<TResponse>
  },
  refresh: () => Promise<void> | void,
  options: {
    /** Used in create/update/delete toast messages, e.g. 'User'. */
    entityName: string
    /** Initial createForm value each time the Create modal is opened. */
    createDefaults: () => Record<string, any>
    /** Row -> editForm value when the Edit modal is opened. */
    toForm?: (row: TResponse) => Record<string, any>
    /** DynamicForm values -> create request body. */
    toPayload: (values: Record<string, any>) => TRequest
    /** DynamicForm values -> update request body. The edit form often covers a
     * different field set than create (e.g. no password), so this defaults to
     * `toPayload` only when the two shapes actually line up. */
    toEditPayload?: (values: Record<string, any>) => TEditRequest
    /** Called with the created row after a successful create + refresh — e.g. to redirect to its detail page. */
    onCreated?: (created: TResponse) => void | Promise<void>
  }
) {
  const toast = useToast()

  const showCreate = ref(false)
  const creating = ref(false)
  const error = ref('')
  const createForm = ref<Record<string, any>>({})

  function openCreate() {
    createForm.value = options.createDefaults()
    error.value = ''
    showCreate.value = true
  }

  async function onCreate(values: Record<string, any>) {
    creating.value = true
    error.value = ''
    try {
      const created = await actions.create(options.toPayload(values))
      toast.add({ title: `${options.entityName} created`, color: 'success' })
      showCreate.value = false
      await refresh()
      await options.onCreated?.(created)
    } catch (err) {
      error.value = apiErrorMessage(err)
    } finally {
      creating.value = false
    }
  }

  const showEdit = ref(false)
  const editing = ref(false)
  const editError = ref('')
  const editingRow = ref<TResponse | null>(null)
  const editForm = ref<Record<string, any>>({})

  function openEdit(row: TResponse) {
    if (!actions.update || !options.toForm) return
    editingRow.value = row
    editForm.value = options.toForm(row)
    editError.value = ''
    showEdit.value = true
  }

  async function onEdit(values: Record<string, any>) {
    if (!actions.update || editingRow.value === null) return
    editing.value = true
    editError.value = ''
    try {
      const buildEditPayload = options.toEditPayload ?? (options.toPayload as unknown as (values: Record<string, any>) => TEditRequest)
      await actions.update(editingRow.value, buildEditPayload(values))
      toast.add({ title: `${options.entityName} updated`, color: 'success' })
      showEdit.value = false
      await refresh()
    } catch (err) {
      editError.value = apiErrorMessage(err)
    } finally {
      editing.value = false
    }
  }

  const deleting = ref(false)
  const confirmDelete = ref<TResponse | null>(null)

  async function onDelete() {
    if (!actions.remove || !confirmDelete.value) return
    deleting.value = true
    try {
      await actions.remove(confirmDelete.value)
      toast.add({ title: `${options.entityName} deleted`, color: 'success' })
      confirmDelete.value = null
      await refresh()
    } catch (err) {
      toast.add({ title: `Could not delete ${options.entityName.toLowerCase()}`, description: apiErrorMessage(err), color: 'error' })
    } finally {
      deleting.value = false
    }
  }

  return {
    showCreate,
    creating,
    error,
    createForm,
    openCreate,
    onCreate,
    showEdit,
    editing,
    editError,
    editingRow,
    editForm,
    openEdit,
    onEdit,
    deleting,
    confirmDelete,
    onDelete
  }
}
