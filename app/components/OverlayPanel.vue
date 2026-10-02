<template>
  <div class="space-y-4 text-sm">
    <!-- ── Add ─────────────────────────────────────────────────────────── -->
    <section class="flex flex-wrap items-center gap-1" data-testid="overlay-add">
      <UButton size="xs" color="neutral" :class="TAB_ACCENTS.overlay.button" icon="i-lucide-type" @click="edit.addText(currentMs)">Add text</UButton>
      <UDropdownMenu :items="presetItems">
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-wand-sparkles" trailing-icon="i-lucide-chevron-down">Presets</UButton>
      </UDropdownMenu>
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
      <UPopover v-model:open="subsOpen" @update:open="(v: boolean) => v && loadTracks()">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-captions">From subtitles</UButton>
        <template #content>
          <div class="w-64 p-2 space-y-1 text-sm">
            <p class="px-1 text-xs text-gray-500 dark:text-gray-400">One text layer per cue of a subtitle track of this video.</p>
            <p v-if="tracksLoading" class="px-1 py-2 text-xs text-gray-500">Loading…</p>
            <p v-else-if="!tracks.length" class="px-1 py-2 text-xs text-gray-500">This video has no subtitle tracks yet.</p>
            <button
              v-for="t in tracks"
              :key="t.id"
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              :disabled="importingTrack === t.id"
              @click="importTrack(t)"
            >
              <span class="truncate"
                >{{ t.label }} <span class="text-xs text-gray-500 dark:text-gray-400">{{ t.language }}</span></span
              >
              <span class="text-xs text-gray-500 shrink-0 dark:text-gray-400">{{ t.cueCount }} cues</span>
            </button>
          </div>
        </template>
      </UPopover>
    </section>

    <!-- ── Layers ──────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Layers <span class="normal-case font-normal">— later ones are drawn on top</span></h3>
      <OverlayTimeline :edit="edit" :duration-ms="durationMs" :current-ms="currentMs" @seek="(ms) => emit('preview', ms, false)" />
      <ul
        v-if="s.layers.length"
        ref="layerList"
        class="divide-y divide-gray-100 dark:divide-gray-800 rounded-md border border-gray-200 dark:border-gray-800"
        data-testid="overlay-list"
      >
        <li
          v-for="(l, i) in s.layers"
          :key="l.id"
          :data-layer-id="l.id"
          draggable="true"
          :aria-current="edit.isPicked(l.id) ? 'true' : undefined"
          class="flex items-center gap-2 px-2 py-1.5"
          :class="[
            edit.isPicked(l.id) ? TAB_ACCENTS.overlay.selected : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
            dragId === l.id ? 'opacity-40' : '',
            dropLine(i) === 'before'
              ? 'shadow-[inset_0_2px_0_0_var(--ui-primary)]'
              : dropLine(i) === 'after'
                ? 'shadow-[inset_0_-2px_0_0_var(--ui-primary)]'
                : ''
          ]"
          @dragstart="onDragStart($event, l.id)"
          @dragover="onDragOver($event, i)"
          @drop.prevent="onDrop"
          @dragend="clearDrag"
        >
          <UIcon
            name="i-lucide-grip-vertical"
            class="w-4 h-4 shrink-0 cursor-grab text-gray-300 dark:text-gray-600"
            aria-hidden="true"
            title="Drag to reorder"
          />
          <button
            type="button"
            class="flex flex-1 min-w-0 flex-col gap-1 text-left rounded"
            :aria-pressed="edit.isPicked(l.id)"
            title="Shift-click to pick several"
            @click="onRowClick(l.id, $event)"
          >
            <span class="flex w-full min-w-0 items-center gap-2">
              <UIcon :name="l.kind === 'TEXT' ? 'i-lucide-type' : 'i-lucide-image'" class="w-4 h-4 shrink-0" :class="TAB_ACCENTS.overlay.icon" />
              <span class="flex-1 truncate">{{ l.kind === 'TEXT' ? l.text || '(empty)' : l.imageName }}</span>
              <span class="text-xs tabular-nums text-gray-500 shrink-0"
                >{{ formatTimecode(l.startMs) }}–{{ l.endMs == null ? 'end' : formatTimecode(l.endMs) }}</span
              >
            </span>
          </button>
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
      <div v-else class="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center space-y-3" data-testid="overlay-empty">
        <UIcon name="i-lucide-layers" class="mx-auto h-7 w-7 text-gray-300 dark:text-gray-600" />
        <p class="text-xs text-gray-500 dark:text-gray-400">No layers yet. Start with one of these, add text or an image above, or pick a template below.</p>
        <div class="flex flex-wrap justify-center gap-1.5">
          <UButton
            v-for="item in presetItems[0]"
            :key="item.label"
            size="xs"
            color="neutral"
            variant="soft"
            :class="TAB_ACCENTS.overlay.soft"
            :icon="item.icon"
            @click="item.onSelect()"
          >
            {{ item.label }}
          </UButton>
        </div>
      </div>
    </section>

    <!-- ── Several picked ─────────────────────────────────────────────── -->
    <section
      v-if="s.multi.length"
      class="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 p-2 space-y-2"
      data-testid="overlay-group"
    >
      <p class="text-xs font-medium">
        {{ s.multi.length + 1 }} layers picked
        <span class="font-normal text-gray-500">— dragging or the arrow keys move them together; the settings below are for the first one</span>
      </p>
      <div class="flex flex-wrap items-center gap-1">
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" @click="edit.duplicateGroup()">Duplicate</UButton>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-align-horizontal-justify-center" @click="edit.alignGroup('x')">Same X</UButton>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-align-vertical-justify-center" @click="edit.alignGroup('y')">Same Y</UButton>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-paintbrush" @click="onMatchStyle">Same style</UButton>
        <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="edit.removeGroup()">Delete</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="edit.select(s.selectedId)">Only the first</UButton>
      </div>
    </section>

    <!-- ── Selected layer ──────────────────────────────────────────────── -->
    <template v-if="layer">
      <EditorSection v-if="layer.kind === 'TEXT'" v-model:open="open.content" title="Text" :hint="layer.text || '(empty)'" data-testid="text-fields">
        <UTextarea
          :model-value="layer.text ?? ''"
          :rows="2"
          autoresize
          placeholder="Type the text"
          aria-label="Text"
          class="w-full"
          @update:model-value="(v) => layer && (layer.text = String(v))"
        />
      </EditorSection>

      <EditorSection v-if="layer.kind === 'TEXT'" v-model:open="open.style" title="Style" :hint="`${layer.font ?? 'SansSerif'} · ${layer.sizePct}%`">
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
            >
              <template #item-label="{ item }">
                <span :style="{ fontFamily: fontCss(String(item)) }">{{ item }}</span>
              </template>
            </USelectMenu>
          </UFormField>
          <UFormField label="Weight">
            <USelect v-model="layer.weight" :items="LAYER_WEIGHTS" class="w-full" size="sm" aria-label="Weight" />
          </UFormField>
        </div>
        <SliderRow v-model="layer.sizePct" label="Size" :min="1" :max="30" :step="0.5" :default-value="6" unit="%" />
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
          <div class="flex items-center gap-1" role="group" aria-label="Quick text colours">
            <button
              v-for="c in SWATCHES"
              :key="c"
              type="button"
              class="h-5 w-5 rounded-full border border-gray-300 dark:border-gray-600 focus-visible:outline-2 focus-visible:outline-rose-500"
              :class="layer.color?.toLowerCase() === c ? 'ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-gray-900' : ''"
              :style="{ backgroundColor: c }"
              :aria-label="`Text colour ${c}`"
              @click="layer && (layer.color = c)"
            />
          </div>
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
        <SliderRow
          v-if="layer.background"
          label="Box"
          :model-value="Math.round(layer.backgroundOpacity * 100)"
          :min="0"
          :max="100"
          :step="5"
          :default-value="55"
          unit="%"
          @update:model-value="(v) => layer && (layer.backgroundOpacity = v / 100)"
        />
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
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-paintbrush"
          :disabled="s.layers.filter((l) => l.kind === 'TEXT').length < 2"
          @click="onApplyStyle"
        >
          Use this style for all text
        </UButton>
      </EditorSection>

      <EditorSection v-else v-model:open="open.content" title="Image" :hint="layer.imageName ?? undefined">
        <div class="flex items-center gap-2">
          <img v-if="layer.imageUrl" :src="layer.imageUrl" alt="" class="h-10 w-10 rounded object-contain bg-gray-100 dark:bg-gray-800" />
          <span class="flex-1 truncate">{{ layer.imageName }}</span>
        </div>
        <SliderRow v-model="layer.widthPct" label="Width" :min="1" :max="100" :step="1" :default-value="20" unit="%" />
      </EditorSection>

      <EditorSection v-model:open="open.position" title="Position & look" :hint="`Opacity ${Math.round(layer.opacity * 100)}%`">
        <div class="flex items-start gap-3">
          <div class="grid grid-cols-3 gap-1" role="group" aria-label="Position presets">
            <button
              v-for="(spot, i) in LAYER_SPOTS"
              :key="i"
              type="button"
              class="h-5 w-7 rounded-sm border"
              :class="
                Math.abs(layer.x - spot.x) < 0.01 && Math.abs(layer.y - spot.y) < 0.01
                  ? 'bg-rose-500 border-rose-500'
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
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">Or drag it on the video (double-click text to type on it).</p>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-scan" class="ml-auto" @click="edit.keepInSafeArea(layer.id)"
            >Keep in safe area</UButton
          >
        </div>
        <SliderRow
          label="Opacity"
          :model-value="Math.round(layer.opacity * 100)"
          :min="5"
          :max="100"
          :step="5"
          :default-value="100"
          unit="%"
          @update:model-value="(v) => layer && (layer.opacity = v / 100)"
        />
      </EditorSection>

      <EditorSection
        v-model:open="open.timing"
        title="Timing"
        :hint="`${formatTimecode(layer.startMs)} – ${layer.endMs == null ? 'end' : formatTimecode(layer.endMs)}`"
      >
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
          <div class="flex items-center gap-2">
            <USelect v-model="layer.animation" :items="LAYER_ANIMATIONS" class="flex-1" size="sm" aria-label="Animation" />
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-play" @click="emit('preview', Math.max(0, layer.startMs - 300), true)"
              >Play</UButton
            >
          </div>
        </UFormField>
      </EditorSection>
    </template>

    <!-- ── Templates ───────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.templates" title="Templates" hint="click one to add it">
      <div class="flex items-center justify-between">
        <p class="text-xs text-gray-500 dark:text-gray-400">The starred ones ship with the editor.</p>
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
            class="group flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800 pl-1.5 pr-1 py-1 cursor-pointer hover:border-rose-400"
            @click="edit.addTemplate(t.data)"
          >
            <OverlayTemplateThumb :layers="t.data" />
            <span class="text-xs">
              <span class="flex items-center gap-1">
                <UIcon v-if="t.builtin" name="i-lucide-star" class="w-3 h-3 text-amber-400" />
                {{ t.name }}
              </span>
              <span class="text-gray-500 dark:text-gray-400">{{ t.data.length }} layer{{ t.data.length === 1 ? '' : 's' }}</span>
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
    </EditorSection>

    <!-- ── Render ──────────────────────────────────────────────────────── -->
    <section :class="ACTION_SECTION">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The server draws the text with its own copy of the font, so it can differ slightly from this preview.
      </p>
      <p class="text-xs text-error-600 dark:text-error-400 min-h-4">{{ edit.error.value }}</p>
      <div class="flex gap-2">
        <UButton
          v-if="canWrite"
          color="neutral"
          :class="['flex-1 justify-center', TAB_ACCENTS.overlay.button]"
          icon="i-lucide-layers"
          :loading="starting"
          :disabled="!!edit.error.value || busy || !!uploading"
          @click="onRender"
        >
          Render layers
        </UButton>
        <UTooltip text="Undoable — Ctrl/⌘+Z brings the layers back">
          <UButton class="ml-2" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!s.layers.length" @click="confirmClear = true"
            >Clear</UButton
          >
        </UTooltip>
      </div>
    </section>

    <ConfirmModal
      v-model="confirmClear"
      title="Remove all layers"
      :description="`Remove all ${s.layers.length} layer${s.layers.length === 1 ? '' : 's'}? Ctrl/⌘+Z brings them back.`"
      confirm-label="Remove all"
      color="error"
      @confirm="onConfirmClear"
    />

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
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
// The "Text" tab: titles, captions, logos and watermarks. Layers
// are shown and dragged on the video (OverlayLayers); both work on the same
// useOverlayEdit state. Rendering runs as an EDIT job; the result appears in
// Results to preview before replacing the original.
import { LAYER_ANIMATIONS, LAYER_SPOTS, LAYER_WEIGHTS, fontCss, type OverlayEdit } from '~/composables/useOverlayEdit'
import { uploadToStorage } from '~/composables/useVideos'
import { formatTimecode } from '#shared/utils/transport'
import { dropIndex } from '#shared/utils/reorder'
import { useOverlayTemplates, type OverlayTemplate } from '~/composables/useOverlayTemplates'

const props = defineProps<{ edit: OverlayEdit; videoId: number; durationMs: number; currentMs: number; canWrite: boolean; busy: boolean }>()
const emit = defineEmits<{ queued: []; preview: [ms: number, play?: boolean] }>()

const SECTION = `space-y-2 border-t pt-3 ${TAB_ACCENTS.overlay.divider}`
const ACTION_SECTION = `sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-3 ${TAB_ACCENTS.overlay.divider}`
const HEADING = `text-xs font-semibold uppercase tracking-wide ${TAB_ACCENTS.overlay.heading}`
const ALIGNS = [
  { value: 'LEFT', icon: 'i-lucide-align-left' },
  { value: 'CENTER', icon: 'i-lucide-align-center' },
  { value: 'RIGHT', icon: 'i-lucide-align-right' }
] as const
const SPOT_NAMES = ['top left', 'top centre', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom centre', 'bottom right']

// Which groups of the selected layer are unfolded; timing is rarely touched, so it starts folded.
const open = reactive({ content: true, style: true, position: true, timing: false, templates: !props.edit.state.layers.length })
const SWATCHES = ['#ffffff', '#000000', '#ffd60a', '#ff453a', '#30d158', '#0a84ff']

const s = props.edit.state

// Templates are the way in for an empty tab; once there are layers they fold away.
watch(
  () => s.layers.length,
  (n, was) => {
    if (was === 0 && n > 0) open.templates = false
    else if (n === 0) open.templates = true
  }
)

const presetItems = [
  [
    { label: 'Title', icon: 'i-lucide-heading', onSelect: () => props.edit.addPreset('TITLE', props.currentMs) },
    { label: 'Lower third', icon: 'i-lucide-rectangle-horizontal', onSelect: () => props.edit.addPreset('LOWER_THIRD', props.currentMs) },
    { label: 'Caption', icon: 'i-lucide-subtitles', onSelect: () => props.edit.addPreset('CAPTION', props.currentMs) }
  ]
]

function onRowClick(id: string, e: MouseEvent) {
  if (e.shiftKey || e.ctrlKey || e.metaKey) props.edit.toggleMulti(id)
  else props.edit.select(id)
}

function onMatchStyle() {
  const n = props.edit.matchStyleInGroup()
  toast.add({ title: n ? `Style copied to ${n} layer${n === 1 ? '' : 's'}` : 'Pick other text layers first', color: n ? 'success' : 'warning' })
}

function onApplyStyle() {
  if (!layer.value) return
  const n = props.edit.applyStyleToAll(layer.value.id)
  toast.add({ title: `Style applied to ${n} other text layer${n === 1 ? '' : 's'}`, description: 'Ctrl/⌘+Z undoes it.', color: 'success' })
}

// ── Import the video's subtitle cues as text layers ─────────────────────────
const MAX_IMPORT = 200
const { list: listSubtitles, get: getSubtitle } = useSubtitles()
type Track = Awaited<ReturnType<typeof listSubtitles>>['data'][number]
const subsOpen = ref(false)
const tracks = ref<Track[]>([])
const tracksLoading = ref(false)
const importingTrack = ref<number | null>(null)

async function loadTracks() {
  tracksLoading.value = true
  try {
    tracks.value = (await listSubtitles({ videoId: props.videoId, size: 50 })).data
  } catch (err) {
    tracks.value = []
    toast.add({ title: 'Could not load subtitles', description: apiErrorMessage(err), color: 'error' })
  } finally {
    tracksLoading.value = false
  }
}

async function importTrack(t: Track) {
  importingTrack.value = t.id
  try {
    const cues = ((await getSubtitle(t.id)).cues ?? []).slice(0, MAX_IMPORT)
    const n = props.edit.addFromCues(cues)
    subsOpen.value = false
    toast.add({
      title: n ? `${n} text layer${n === 1 ? '' : 's'} added from “${t.label}”` : 'That track has no usable cues',
      description: n && t.cueCount > MAX_IMPORT ? `Only the first ${MAX_IMPORT} cues were imported.` : undefined,
      color: n ? 'success' : 'warning'
    })
  } catch (err) {
    toast.add({ title: 'Could not import the subtitles', description: apiErrorMessage(err), color: 'error' })
  } finally {
    importingTrack.value = null
  }
}

// A layer picked on the video may be far down a long list: bring its row into view.
// ("nearest" leaves the page alone when the row is already visible, e.g. after a click on it.)
const layerList = useTemplateRef<HTMLElement>('layerList')
watch(
  () => s.selectedId,
  async (id) => {
    if (!id) return
    await nextTick()
    layerList.value?.querySelector(`[data-layer-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }
)

// ── Drag to reorder ──────────────────────────────────────────────────────────
// Native drag and drop; the arrow buttons on each row do the same from the keyboard.
const dragId = ref<string | null>(null)
const overIndex = ref<number | null>(null)
const overHalf = ref<'before' | 'after'>('before')

function onDragStart(event: DragEvent, id: string) {
  dragId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id) // Firefox won't start a drag without data
  }
}
function onDragOver(event: DragEvent, index: number) {
  if (!dragId.value) return
  event.preventDefault() // marks the row as a drop target
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  overIndex.value = index
  overHalf.value = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}
function clearDrag() {
  dragId.value = null
  overIndex.value = null
}
function onDrop() {
  const from = s.layers.findIndex((l) => l.id === dragId.value)
  if (dragId.value && from >= 0 && overIndex.value !== null) props.edit.moveTo(dragId.value, dropIndex(from, overIndex.value, overHalf.value))
  clearDrag()
}
/** Where to draw the drop line on row `i`: only when dropping there would actually move the layer. */
function dropLine(i: number): 'before' | 'after' | null {
  if (!dragId.value || overIndex.value !== i) return null
  const from = s.layers.findIndex((l) => l.id === dragId.value)
  return dropIndex(from, i, overHalf.value) === from ? null : overHalf.value
}

const confirmClear = ref(false)
function onConfirmClear() {
  confirmClear.value = false
  props.edit.reset()
}

/** The layer's on-screen span as a position within the whole video. */
function layerBar(l: { startMs: number; endMs: number | null }) {
  const total = props.durationMs || 1
  const start = Math.min(100, Math.max(0, (l.startMs / total) * 100))
  const end = Math.min(100, Math.max(start, ((l.endMs ?? total) / total) * 100))
  return { left: `${start}%`, width: `${Math.max(end - start, 1)}%` }
}

const toast = useToast()
const { startOverlay, fonts } = useVideoEdits()
const { requestUpload } = useVideos()
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
