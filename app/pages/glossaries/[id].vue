<template>
  <div>
    <PageHeader
      :title="isNew ? 'New glossary' : (glossary?.name ?? 'Glossary')"
      :description="headerDescription"
      :crumbs="[{ label: 'Glossaries', to: '/glossaries' }, { label: isNew ? 'New' : glossary ? glossary.name : '…' }]"
    >
      <template v-if="canWrite && (isNew || glossary)" #actions>
        <UButton color="neutral" variant="ghost" to="/glossaries" :disabled="saving">Cancel</UButton>
        <UButton icon="i-lucide-save" :loading="saving" :disabled="!canSave" @click="save">{{ isNew ? 'Create glossary' : 'Save' }}</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/glossaries">Back to glossaries</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading" :fields="4" />

    <div v-else-if="isNew || glossary" class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-gray-900 dark:text-white">Glossary</h2>
        </template>
        <fieldset :disabled="!canWrite" class="space-y-4">
          <UFormField label="Name" required>
            <UInput v-model="form.name" maxlength="100" placeholder="e.g. Product terms → Khmer" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="From" hint="optional">
              <USelect v-model="form.sourceLanguage" :items="sourceOptions" class="w-full" />
            </UFormField>
            <UFormField label="Into" required>
              <USelect v-model="form.targetLanguage" :items="languageOptions(form.targetLanguage)" placeholder="Choose" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Description" hint="optional">
            <UTextarea v-model="form.description" :rows="2" maxlength="300" class="w-full" />
          </UFormField>
          <USwitch v-model="form.enabled" label="Enabled" description="Off keeps the terms but stops translations and checks from using them." />
        </fieldset>
        <template #footer>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Translations into {{ form.targetLanguage ? languageLabel(form.targetLanguage) : 'this language' }} follow these terms. Only the terms a
            passage actually mentions are sent with it, so large glossaries stay cheap.
          </p>
        </template>
      </UCard>

      <UCard class="xl:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">Terms</h2>
              <UBadge color="neutral" variant="subtle" size="sm">{{ terms.length.toLocaleString() }}</UBadge>
              <UBadge v-if="problemCount" color="error" variant="subtle" size="sm">{{ problemCount }} to fix</UBadge>
            </div>
            <div class="flex items-center gap-2">
              <UInput v-model="termSearch" size="sm" icon="i-lucide-search" placeholder="Find a term" class="w-44" />
              <UButton v-if="canWrite" size="sm" color="neutral" variant="soft" icon="i-lucide-clipboard-paste" @click="openPaste">Paste list</UButton>
              <UButton v-if="canWrite" size="sm" icon="i-lucide-plus" @click="addTerm">Add term</UButton>
            </div>
          </div>
        </template>

        <EmptyState
          v-if="!terms.length"
          icon="i-lucide-book-a"
          title="No terms yet"
          description="Add terms one by one, or paste a list copied from a spreadsheet."
          class="py-10"
        />
        <div v-else class="max-h-[70vh] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500">
              <tr>
                <th class="px-4 py-2 font-medium">Source</th>
                <th class="px-2 py-2 font-medium">Translation</th>
                <th class="px-2 py-2 font-medium text-center" title="Keep the source wording exactly">Keep as-is</th>
                <th class="px-2 py-2 font-medium text-center">Match case</th>
                <th class="px-2 py-2 font-medium">Note</th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="i in visibleTerms" :key="terms[i]!.key" :class="termErrors[i] ? 'bg-error-50/60 dark:bg-error-950/30' : ''">
                <td class="px-4 py-1.5 align-top">
                  <UInput v-model="terms[i]!.source" size="sm" maxlength="200" :disabled="!canWrite" class="w-full" aria-label="Source term" />
                  <p v-if="termErrors[i]" class="text-xs text-error-600 dark:text-error-400 mt-1">{{ termErrors[i] }}</p>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <UInput
                    v-model="terms[i]!.target"
                    size="sm"
                    maxlength="200"
                    :disabled="!canWrite || terms[i]!.doNotTranslate"
                    :placeholder="terms[i]!.doNotTranslate ? 'Kept as the source' : ''"
                    class="w-full"
                    aria-label="Translation"
                  />
                </td>
                <td class="px-2 py-1.5 text-center align-top pt-3">
                  <UCheckbox v-model="terms[i]!.doNotTranslate" :disabled="!canWrite" aria-label="Keep as-is" class="inline-flex" />
                </td>
                <td class="px-2 py-1.5 text-center align-top pt-3">
                  <UCheckbox v-model="terms[i]!.caseSensitive" :disabled="!canWrite" aria-label="Match case" class="inline-flex" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <UInput v-model="terms[i]!.note" size="sm" maxlength="300" :disabled="!canWrite" placeholder="optional" class="w-full" aria-label="Note" />
                </td>
                <td class="pr-3 py-1.5 align-top">
                  <UButton v-if="canWrite" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Remove term" @click="terms.splice(i, 1)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="termSearch && !visibleTerms.length" class="px-4 py-6 text-sm text-center text-gray-500">No term matches “{{ termSearch }}”.</p>
        </div>
      </UCard>
    </div>

    <!-- Paste a list -->
    <UModal v-model:open="showPaste" title="Paste terms" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            One term per line: <code class="text-xs">source,translation,note</code> — or copy two or three columns straight from a spreadsheet. Leave the
            translation blank (or write <code class="text-xs">=</code>) to keep a term as-is.
          </p>
          <UTextarea v-model="pasteText" :rows="10" class="w-full font-mono text-xs" placeholder="dashboard,ផ្ទាំងគ្រប់គ្រង&#10;VideoLingo,=&#10;invoice,វិក្កយបត្រ,accounting" />
          <p class="text-xs text-gray-500">
            {{ pasted.length }} term(s) found<span v-if="pastedDuplicates">, {{ pastedDuplicates }} already in the list (they'll be updated)</span>.
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showPaste = false">Cancel</UButton>
            <UButton icon="i-lucide-clipboard-paste" :disabled="!pasted.length" @click="applyPaste">Add {{ pasted.length || '' }} term(s)</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Glossary } from '~/composables/useGlossaries'

definePageMeta({ middleware: 'admin' })

interface TermRow {
  key: number
  source: string
  target: string
  doNotTranslate: boolean
  caseSensitive: boolean
  note: string
}

const route = useRoute()
const toast = useToast()
const { get, create, update } = useGlossaries()
const { can } = useAuth()
const canWrite = computed(() => can('glossaries', 'WRITE'))

const isNew = computed(() => route.params.id === 'new')
const glossary = ref<Glossary | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')

let nextKey = 0
const form = reactive<{ name: string; sourceLanguage: string | undefined; targetLanguage: string | undefined; description: string; enabled: boolean }>({
  name: '',
  sourceLanguage: undefined,
  targetLanguage: undefined,
  description: '',
  enabled: true
})
const terms = ref<TermRow[]>([])
let pristine = ''

const sourceOptions = computed(() => [{ label: 'Any language', value: undefined }, ...languageOptions(form.sourceLanguage)])

const headerDescription = computed(() => {
  if (isNew.value) return 'Terms translations into one language must follow.'
  const g = glossary.value
  if (!g) return undefined
  return `${g.sourceLanguage ? languageLabel(g.sourceLanguage) : 'Any language'} → ${languageLabel(g.targetLanguage)} · ${g.enabled ? 'Enabled' : 'Off'}${
    g.updatedBy ? ` · last saved by ${g.updatedBy}` : ''
  }`
})

function fill(g: Glossary | null) {
  Object.assign(form, {
    name: g?.name ?? '',
    sourceLanguage: g?.sourceLanguage ?? undefined,
    targetLanguage: g?.targetLanguage ?? undefined,
    description: g?.description ?? '',
    enabled: g?.enabled ?? true
  })
  terms.value = (g?.terms ?? []).map((t) => ({
    key: nextKey++,
    source: t.source,
    target: t.doNotTranslate ? '' : t.target,
    doNotTranslate: t.doNotTranslate,
    caseSensitive: t.caseSensitive,
    note: t.note ?? ''
  }))
  pristine = snapshot()
}

function snapshot() {
  return JSON.stringify({ form, terms: terms.value.map(({ key: _key, ...t }) => t) })
}

const isDirty = computed(() => snapshot() !== pristine)
useUnsavedChangesGuard(computed(() => canWrite.value && isDirty.value && !saving.value))

async function load() {
  if (isNew.value) {
    fill(null)
    return
  }
  loading.value = true
  error.value = ''
  try {
    glossary.value = await get(Number(route.params.id))
    fill(glossary.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

// ── Terms ──────────────────────────────────────────────────────────────────
const termSearch = ref('')
const visibleTerms = computed(() => {
  const q = termSearch.value.trim().toLowerCase()
  const all = terms.value.map((_, i) => i)
  if (!q) return all
  return all.filter((i) => {
    const t = terms.value[i]!
    return t.source.toLowerCase().includes(q) || t.target.toLowerCase().includes(q) || t.note.toLowerCase().includes(q)
  })
})

const termErrors = computed(() => {
  const seen = new Map<string, number>()
  return terms.value.map((t, i) => {
    const source = t.source.trim().replace(/\s+/g, ' ')
    if (!source) return 'Enter the source term'
    const k = source.toLowerCase()
    if (seen.has(k)) return `Same as term ${seen.get(k)! + 1}`
    seen.set(k, i)
    if (!t.doNotTranslate && !t.target.trim()) return 'Give a translation, or tick “Keep as-is”'
    return ''
  })
})
const problemCount = computed(() => termErrors.value.filter(Boolean).length)

function addTerm() {
  termSearch.value = ''
  terms.value.push({ key: nextKey++, source: '', target: '', doNotTranslate: false, caseSensitive: false, note: '' })
  nextTick(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('tbody tr:last-child input')
    inputs[0]?.focus()
  })
}

const canSave = computed(() => canWrite.value && !!form.name.trim() && !!form.targetLanguage && !problemCount.value && (isNew.value || isDirty.value))

async function save() {
  if (!canSave.value || !form.targetLanguage) return
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      sourceLanguage: form.sourceLanguage ?? null,
      targetLanguage: form.targetLanguage,
      description: form.description.trim() || null,
      enabled: form.enabled,
      terms: terms.value.map((t) => ({
        source: t.source.trim(),
        target: t.doNotTranslate ? t.source.trim() : t.target.trim(),
        doNotTranslate: t.doNotTranslate,
        caseSensitive: t.caseSensitive,
        note: t.note.trim() || null
      }))
    }
    if (isNew.value) {
      const created = await create(payload)
      pristine = snapshot()
      toast.add({ title: `“${created.name}” created`, description: `${created.termCount} term(s)`, color: 'success' })
      await navigateTo(`/glossaries/${created.id}`, { replace: true })
    } else {
      glossary.value = await update(glossary.value!.id, payload)
      fill(glossary.value)
      toast.add({ title: 'Glossary saved', description: `${glossary.value.termCount} term(s)`, color: 'success' })
    }
  } catch (err) {
    toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Paste ──────────────────────────────────────────────────────────────────
const showPaste = ref(false)
const pasteText = ref('')
const pasted = computed(() => parseGlossaryLines(pasteText.value))
const pastedDuplicates = computed(() => {
  const existing = new Set(terms.value.map((t) => t.source.trim().toLowerCase()))
  return pasted.value.filter((p) => existing.has(p.source.toLowerCase())).length
})

function openPaste() {
  pasteText.value = ''
  showPaste.value = true
}

// Pasted terms update same-named existing ones, else are appended.
function applyPaste() {
  const bySource = new Map(terms.value.map((t) => [t.source.trim().toLowerCase(), t]))
  for (const p of pasted.value) {
    const row = { source: p.source, target: p.doNotTranslate ? '' : p.target, doNotTranslate: p.doNotTranslate, caseSensitive: p.caseSensitive, note: p.note ?? '' }
    const existing = bySource.get(p.source.toLowerCase())
    if (existing) Object.assign(existing, row)
    else {
      const added = { key: nextKey++, ...row }
      terms.value.push(added)
      bySource.set(p.source.toLowerCase(), added)
    }
  }
  toast.add({ title: `${pasted.value.length} term(s) added`, description: 'Save to keep them.', color: 'success' })
  showPaste.value = false
}

watch(() => route.params.id, load)
onMounted(load)
</script>
