<template>
  <div class="space-y-4 text-sm">
    <!-- ── Add ─────────────────────────────────────────────────────────── -->
    <section class="flex flex-wrap items-center gap-1">
      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-type" @click="edit.addText(currentMs)">Add text</UButton>
      <UploadButton
        label="Add image"
        icon="i-lucide-image-plus"
        accept="image/png,image/jpeg,image/webp"
        :progress="uploading === 'image' ? uploadProgress : null"
        @pick="(f) => onUpload(f, false)"
      />
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copyright" @click="edit.addTextWatermark()">Text watermark</UButton>
      <UploadButton
        label="Logo watermark"
        icon="i-lucide-stamp"
        accept="image/png,image/jpeg,image/webp"
        :progress="uploading === 'watermark' ? uploadProgress : null"
        @pick="(f) => onUpload(f, true)"
      />
    </section>

    <!-- ── Templates ───────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <div class="flex items-center justify-between">
        <h3 :class="HEADING">Templates <span class="normal-case font-normal">— click one to add it; the starred ones ship with the editor</span></h3>
        <div class="flex items-center gap-1">
          <UPopover v-model:open="savingTemplate">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-save" :disabled="!s.layers.length">Save as template</UButton>
            <template #content>
              <form class="flex items-center gap-2 p-2" @submit.prevent="onSaveTemplate">
                <UInput v-model="templateName" size="sm" placeholder="Template name" autofocus class="w-48" />
                <UButton size="sm" type="submit" :disabled="!templateName.trim()">Save</UButton>
              </form>
            </template>
          </UPopover>
          <UTooltip text="Export everything you've saved as a file">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-download"
              aria-label="Export all templates"
              :disabled="!templates.templates.value.some((t) => !t.builtin)"
              @click="templates.exportAll()"
            />
          </UTooltip>
          <UTooltip text="Import templates from a file">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-upload" aria-label="Import templates" @click="importInput?.click()" />
          </UTooltip>
          <input ref="importInput" type="file" accept="application/json" class="hidden" @change="onImportFile" />
        </div>
      </div>
      <ul class="flex flex-wrap gap-2" data-testid="overlay-templates">
        <li v-for="t in templates.templates.value" :key="t.id">
          <div
            class="group flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800 pl-1.5 pr-1 py-1 cursor-pointer hover:border-primary-400"
            @click="edit.addTemplate(t.data)"
          >
            <OverlayTemplateThumb :layers="t.data" />
            <span class="text-xs">
              <span class="flex items-center gap-1">
                <UIcon v-if="t.builtin" name="i-lucide-star" class="w-3 h-3 text-amber-400" />
                {{ t.name }}
              </span>
              <span class="text-gray-400">{{ t.data.length }} layer{{ t.data.length === 1 ? '' : 's' }}</span>
            </span>
            <button
              type="button"
              class="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              :aria-label="`Export template ${t.name}`"
              @click.stop="templates.exportOne(t)"
            >
              <UIcon name="i-lucide-download" class="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button
              v-if="!t.builtin"
              type="button"
              class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-error-50 dark:hover:bg-error-950"
              :aria-label="`Delete template ${t.name}`"
              @click.stop="confirmDeleteTemplate = t"
            >
              <UIcon name="i-lucide-x" class="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- ── Layers ──────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Layers <span class="normal-case font-normal">— later ones are drawn on top</span></h3>
      <ul
        v-if="s.layers.length"
        class="divide-y divide-gray-100 dark:divide-gray-800 rounded-md border border-gray-200 dark:border-gray-800"
        data-testid="overlay-list"
      >
        <li
          v-for="(l, i) in s.layers"
          :key="l.id"
          class="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
          :class="l.id === s.selectedId ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'"
          @click="s.selectedId = l.id"
        >
          <UIcon :name="l.kind === 'TEXT' ? 'i-lucide-type' : 'i-lucide-image'" class="w-4 h-4 text-primary-500 shrink-0" />
          <span class="flex-1 truncate">{{ l.kind === 'TEXT' ? l.text || '(empty)' : l.imageName }}</span>
          <span class="text-xs tabular-nums text-gray-500">{{ formatTimecode(l.startMs) }}–{{ l.endMs == null ? 'end' : formatTimecode(l.endMs) }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-up"
            aria-label="Bring forward"
            :disabled="i === s.layers.length - 1"
            @click.stop="edit.reorder(l.id, 1)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-down"
            aria-label="Send backward"
            :disabled="i === 0"
            @click.stop="edit.reorder(l.id, -1)"
          />
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" aria-label="Duplicate layer" @click.stop="edit.duplicate(l.id)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Delete layer" @click.stop="edit.remove(l.id)" />
        </li>
      </ul>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">No layers yet — add text, an image, or a watermark.</p>
    </section>

    <!-- ── Selected layer ──────────────────────────────────────────────── -->
    <template v-if="layer">
      <section v-if="layer.kind === 'TEXT'" :class="SECTION" data-testid="text-fields">
        <h3 :class="HEADING">Text</h3>
        <UTextarea
          :model-value="layer.text ?? ''"
          :rows="2"
          autoresize
          placeholder="Type the text"
          aria-label="Text"
          class="w-full"
          @update:model-value="(v) => layer && (layer.text = String(v))"
        />
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Font">
            <USelectMenu
              :model-value="layer.font ?? 'SansSerif'"
              :items="fontItems"
              :loading="fontsLoading"
              class="w-full"
              size="sm"
              aria-label="Font"
              @update:model-value="(v) => layer && (layer.font = String(v))"
            />
          </UFormField>
          <UFormField label="Weight">
            <USelect v-model="layer.weight" :items="LAYER_WEIGHTS" class="w-full" size="sm" aria-label="Weight" />
          </UFormField>
        </div>
        <div class="flex items-center gap-3">
          <span class="w-16 text-xs text-gray-500">Size</span>
          <USlider v-model="layer.sizePct" :min="1" :max="30" :step="0.5" class="flex-1" aria-label="Font size" />
          <span class="w-12 text-right text-xs tabular-nums">{{ layer.sizePct }}%</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 text-xs text-gray-500">
            Colour
            <input
              v-model="layer.color"
              type="color"
              aria-label="Text colour"
              class="h-7 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            />
            <UInput
              :model-value="layer.color ?? undefined"
              size="xs"
              class="w-20 font-mono"
              aria-label="Text colour (hex)"
              @change="(e: Event) => setHex('color', (e.target as HTMLInputElement).value)"
            />
          </label>
          <USwitch :model-value="!!layer.background" label="Background" @update:model-value="(v) => layer && (layer.background = v ? '#000000' : null)" />
          <template v-if="layer.background">
            <input
              v-model="layer.background"
              type="color"
              aria-label="Background colour"
              class="h-7 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            />
            <UInput
              :model-value="layer.background ?? undefined"
              size="xs"
              class="w-20 font-mono"
              aria-label="Background colour (hex)"
              @change="(e: Event) => setHex('background', (e.target as HTMLInputElement).value)"
            />
          </template>
        </div>
        <div v-if="layer.background" class="flex items-center gap-3">
          <span class="w-16 text-xs text-gray-500">Box</span>
          <USlider
            :model-value="Math.round(layer.backgroundOpacity * 100)"
            :min="0"
            :max="100"
            :step="5"
            class="flex-1"
            aria-label="Background opacity"
            @update:model-value="(v) => layer && (layer.backgroundOpacity = Number(v) / 100)"
          />
          <span class="w-12 text-right text-xs tabular-nums">{{ Math.round(layer.backgroundOpacity * 100) }}%</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-16 text-xs text-gray-500">Align</span>
          <UButton
            v-for="a in ALIGNS"
            :key="a.value"
            size="xs"
            :icon="a.icon"
            :aria-label="`Align ${a.value.toLowerCase()}`"
            :color="layer.align === a.value ? 'primary' : 'neutral'"
            :variant="layer.align === a.value ? 'soft' : 'ghost'"
            @click="layer.align = a.value"
          />
        </div>
      </section>

      <section v-else :class="SECTION">
        <h3 :class="HEADING">Image</h3>
        <div class="flex items-center gap-2">
          <img v-if="layer.imageUrl" :src="layer.imageUrl" alt="" class="h-10 w-10 rounded object-contain bg-gray-100 dark:bg-gray-800" />
          <span class="flex-1 truncate">{{ layer.imageName }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="w-16 text-xs text-gray-500">Width</span>
          <USlider v-model="layer.widthPct" :min="1" :max="100" :step="1" class="flex-1" aria-label="Image width" />
          <span class="w-12 text-right text-xs tabular-nums">{{ layer.widthPct }}%</span>
        </div>
      </section>

      <section :class="SECTION">
        <h3 :class="HEADING">Position &amp; look</h3>
        <div class="flex items-start gap-3">
          <div class="grid grid-cols-3 gap-1" role="group" aria-label="Position presets">
            <button
              v-for="(spot, i) in LAYER_SPOTS"
              :key="i"
              type="button"
              class="h-5 w-7 rounded-sm border"
              :class="
                Math.abs(layer.x - spot.x) < 0.01 && Math.abs(layer.y - spot.y) < 0.01
                  ? 'bg-primary-500 border-primary-500'
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
              "
              :title="`Place at ${SPOT_NAMES[i]}`"
              :aria-label="`Place at ${SPOT_NAMES[i]}`"
              @click="Object.assign(layer, spot)"
            />
          </div>
          <div class="grid grid-cols-2 gap-2 flex-1">
            <UFormField label="X %">
              <UInput
                :model-value="Math.round(layer.x * 1000) / 10"
                type="number"
                step="0.5"
                min="0"
                max="100"
                size="sm"
                @update:model-value="(v) => layer && (layer.x = pct(v))"
              />
            </UFormField>
            <UFormField label="Y %">
              <UInput
                :model-value="Math.round(layer.y * 1000) / 10"
                type="number"
                step="0.5"
                min="0"
                max="100"
                size="sm"
                @update:model-value="(v) => layer && (layer.y = pct(v))"
              />
            </UFormField>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">Or drag it on the video.</p>
        <div class="flex items-center gap-3">
          <span class="w-16 text-xs text-gray-500">Opacity</span>
          <USlider
            :model-value="Math.round(layer.opacity * 100)"
            :min="5"
            :max="100"
            :step="5"
            class="flex-1"
            aria-label="Opacity"
            @update:model-value="(v) => layer && (layer.opacity = Number(v) / 100)"
          />
          <span class="w-12 text-right text-xs tabular-nums">{{ Math.round(layer.opacity * 100) }}%</span>
        </div>
      </section>

      <section :class="SECTION">
        <h3 :class="HEADING">Timing</h3>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Starts (s)">
            <UInput
              :model-value="sec(layer.startMs)"
              type="number"
              step="0.1"
              min="0"
              size="sm"
              @update:model-value="(v) => layer && (layer.startMs = ms(v))"
            />
          </UFormField>
          <UFormField label="Ends (s)">
            <UInput
              :model-value="layer.endMs == null ? undefined : sec(layer.endMs)"
              type="number"
              step="0.1"
              min="0"
              size="sm"
              placeholder="end"
              :disabled="layer.endMs == null"
              @update:model-value="(v) => layer && (layer.endMs = ms(v))"
            />
          </UFormField>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <UButton size="xs" color="neutral" variant="ghost" @click="layer.startMs = Math.round(currentMs)">Start at playhead</UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="layer.endMs == null"
            @click="layer.endMs = Math.max(Math.round(currentMs), layer.startMs + 100)"
          >
            End at playhead
          </UButton>
          <USwitch
            :model-value="layer.endMs == null"
            label="Until the end"
            class="ml-auto"
            @update:model-value="(v) => layer && (layer.endMs = v ? null : Math.min(durationMs || layer.startMs + 3000, layer.startMs + 3000))"
          />
        </div>
        <UFormField label="Animation">
          <USelect v-model="layer.animation" :items="LAYER_ANIMATIONS" class="w-full" size="sm" aria-label="Animation" />
        </UFormField>
      </section>
    </template>

    <!-- ── Render ──────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The server draws the text with its own copy of the font, so it can differ slightly from this preview.
      </p>
      <p class="text-xs text-error-500 min-h-4">{{ edit.error.value }}</p>
      <div class="flex gap-2">
        <UButton
          v-if="canWrite"
          class="flex-1 justify-center"
          icon="i-lucide-layers"
          :loading="starting"
          :disabled="!!edit.error.value || busy || !!uploading"
          @click="onRender"
        >
          Render layers
        </UButton>
        <UTooltip text="Undoable — Ctrl/⌘+Z brings the layers back">
          <UButton class="ml-2" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!s.layers.length" @click="edit.reset()">Clear</UButton>
        </UTooltip>
      </div>
    </section>

    <ConfirmModal
      :model-value="confirmDeleteTemplate !== null"
      title="Delete template"
      :description="`Delete the saved template “${confirmDeleteTemplate?.name ?? ''}”? Templates aren't part of the editor's undo history, so this can't be undone.`"
      confirm-label="Delete"
      color="error"
      @update:model-value="(v: boolean) => !v && (confirmDeleteTemplate = null)"
      @confirm="onDeleteTemplateConfirm"
    />
  </div>
</template>

<script setup lang="ts">
// The "Text & overlay" tab: titles, captions, logos and watermarks. Layers
// are shown and dragged on the video (OverlayLayers); both work on the same
// useOverlayEdit state. Rendering runs as an EDIT job; the result appears in
// Results to preview before replacing the original.
import { LAYER_ANIMATIONS, LAYER_SPOTS, LAYER_WEIGHTS, type OverlayEdit } from '~/composables/useOverlayEdit'
import { uploadToStorage } from '~/composables/useVideos'
import { formatTimecode } from '#shared/utils/transport'
import { useOverlayTemplates, type OverlayTemplate } from '~/composables/useOverlayTemplates'

const props = defineProps<{ edit: OverlayEdit; videoId: number; durationMs: number; currentMs: number; canWrite: boolean; busy: boolean }>()
const emit = defineEmits<{ queued: [] }>()

const SECTION = 'space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3'
const HEADING = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'
const ALIGNS = [
  { value: 'LEFT', icon: 'i-lucide-align-left' },
  { value: 'CENTER', icon: 'i-lucide-align-center' },
  { value: 'RIGHT', icon: 'i-lucide-align-right' }
] as const
const SPOT_NAMES = ['top left', 'top centre', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom centre', 'bottom right']

const toast = useToast()
const { startOverlay, fonts } = useVideoEdits()
const { requestUpload } = useVideos()
const s = props.edit.state
const layer = computed(() => props.edit.selected.value)

// Applies a typed hex value on blur/Enter only — leaves the field alone
// while mid-edit rather than reverting on every keystroke that isn't a
// complete hex colour yet.
function setHex(field: 'color' | 'background', value: string) {
  if (!layer.value) return
  const hex = value.trim().replace(/^#?/, '#')
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) layer.value[field] = hex
}

// ── Templates ────────────────────────────────────────────────────────────────
const templates = useOverlayTemplates()
const savingTemplate = ref(false)
const templateName = ref('')
function onSaveTemplate() {
  if (!templateName.value.trim()) return
  templates.save(templateName.value, s.layers)
  templateName.value = ''
  savingTemplate.value = false
}

const confirmDeleteTemplate = ref<OverlayTemplate | null>(null)
function onDeleteTemplateConfirm() {
  if (!confirmDeleteTemplate.value) return
  templates.remove(confirmDeleteTemplate.value.id)
  confirmDeleteTemplate.value = null
}

const importInput = useTemplateRef<HTMLInputElement>('importInput')
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const n = await templates.importFile(file)
    toast.add({ title: `Imported ${n} template${n === 1 ? '' : 's'}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not import that file', description: err instanceof Error ? err.message : String(err), color: 'error' })
  }
}

const sec = (v: number) => +(v / 1000).toFixed(2)
const ms = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 1000))
const pct = (v: unknown) => Math.min(1, Math.max(0, (Number(v) || 0) / 100))

// ── Fonts the server has ─────────────────────────────────────────────────────
const fontItems = ref<string[]>(['SansSerif', 'Serif', 'Monospaced'])
const fontsLoading = ref(false)
onMounted(async () => {
  fontsLoading.value = true
  try {
    fontItems.value = await fonts(props.videoId)
  } catch {
    // The three logical fonts above always work.
  } finally {
    fontsLoading.value = false
  }
})

// ── Uploads ──────────────────────────────────────────────────────────────────
const uploading = ref<'image' | 'watermark' | null>(null)
const uploadProgress = ref(0)
async function onUpload(file: File, watermark: boolean) {
  uploading.value = watermark ? 'watermark' : 'image'
  uploadProgress.value = 0
  try {
    const ticket = await requestUpload('OVERLAY', file)
    await uploadToStorage(ticket, file, (f) => (uploadProgress.value = f))
    const added = props.edit.addImage({ key: ticket.key, url: ticket.publicUrl, name: file.name }, watermark)
    if (!watermark) added.startMs = Math.round(props.currentMs)
  } catch (err) {
    toast.add({ title: 'Could not upload the image', description: apiErrorMessage(err), color: 'error' })
  } finally {
    uploading.value = null
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
const starting = ref(false)
async function onRender() {
  if (props.edit.error.value) return
  starting.value = true
  try {
    const job = await startOverlay(props.videoId, props.edit.request.value)
    toast.add({ title: `Text & overlay queued — job #${job.id}`, color: 'success' })
    emit('queued')
  } catch (err) {
    toast.add({ title: 'Could not start the render', description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = false
  }
}
</script>
