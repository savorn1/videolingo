<template>
  <div class="space-y-4">
    <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
    <!-- Shown once: how the editor works, in one line. -->
    <div
      v-if="showTip"
      class="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
      data-testid="editor-tip"
    >
      <UIcon name="i-lucide-lightbulb" class="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
      <ol class="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
        <li><strong>1.</strong> Pick a tool</li>
        <li><strong>2.</strong> Change its settings</li>
        <li><strong>3.</strong> Render</li>
        <li><strong>4.</strong> Add the result as a new video, or replace the original — your original is kept either way</li>
      </ol>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Hide this tip" @click="dismissTip" />
    </div>
    <UAlert
      v-if="draft"
      color="info"
      variant="subtle"
      icon="i-lucide-history"
      :title="`You have unrendered edits from ${formatRelativeTime(new Date(draft.savedAt).toISOString())}`"
      description="They were kept in this browser. Restore them, or start fresh."
      data-testid="draft-notice"
    >
      <template #actions>
        <UButton size="xs" color="info" @click="onRestoreDraft">Restore</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="confirmDiscardDraft = true">Discard</UButton>
      </template>
    </UAlert>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <!-- Preview (large, stays in view while scrolling the controls) -->
      <!-- The stage is what goes full screen, so crop, zoom and the playback bar come along. -->
      <div
        ref="stage"
        data-testid="preview-stage"
        class="xl:col-span-2 xl:sticky xl:top-4 space-y-2"
        :class="stageFullscreen ? 'dark bg-black p-4 flex flex-col justify-center' : ''"
      >
        <!-- Zoomable preview: scroll over it to zoom toward the pointer; when
             zoomed, Space+drag / middle-drag pans. A plain drag crops. -->
        <div
          ref="zoomBox"
          data-testid="preview-zoom"
          class="group relative rounded-lg overflow-hidden bg-black"
          :class="panning ? 'cursor-grabbing' : zoom > 1 && spaceHeld ? 'cursor-grab' : ''"
          :style="fitStyle"
          @wheel="onPreviewWheel"
          @pointerdown.capture="onPanStart"
          @pointerdown="onQuickCropStart"
          @pointerenter="hovering = true"
          @pointerleave="hovering = false"
        >
          <div :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }">
            <!-- A turn or flip shows live here (only while no crop is being drawn, since the crop is on the original picture) -->
            <div
              class="transition-transform duration-200 motion-reduce:transition-none"
              :style="previewOrientStyle"
              :data-orient="previewOriented ? 'on' : undefined"
            >
              <VideoPlayer
                ref="preview"
                :video-url="video.videoUrl"
                :poster="video.thumbnailUrl"
                :title="video.title"
                read-duration
                @time="onTime"
                @duration="onDuration"
              >
                <template v-if="cropActive || overlayEdit.state.layers.length || mode === 'overlay' || showGuides" #overlay>
                  <OverlayLayers
                    v-if="mode === 'overlay' || overlayEdit.state.layers.length"
                    :readonly="mode !== 'overlay'"
                    :edit="overlayEdit"
                    :natural-width="naturalWidth"
                    :natural-height="naturalHeight"
                    :current-ms="currentMs"
                    :duration-ms="durationMs"
                    :zoom="zoom"
                  />
                  <div
                    v-if="showGuides && guideBox"
                    class="pointer-events-none absolute z-10"
                    :style="guideBox.style"
                    data-testid="safe-guide"
                    aria-hidden="true"
                  >
                    <div class="absolute rounded-sm border border-dashed border-emerald-300/90 bg-emerald-400/10" :style="guideBox.safe" />
                    <span class="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-emerald-200">{{ guideBox.label }}</span>
                  </div>
                  <CropOverlay
                    v-if="mode !== 'overlay' && cropActive"
                    ref="cropLayer"
                    :model-value="crop"
                    :natural-width="naturalWidth"
                    :natural-height="naturalHeight"
                    :aspect="cropAspect"
                    :zoom="zoom"
                    @update:model-value="(v) => Object.assign(crop, v)"
                  />
                </template>
              </VideoPlayer>
            </div>
          </div>

          <p
            v-if="orientActive && cropActive"
            class="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-black/70 px-2 py-1 text-[11px] text-white"
            data-testid="orient-note"
          >
            Crop is drawn on the original — {{ describeOrientation(orient) }} comes after
          </p>
          <div
            class="absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/70 px-1 py-0.5 text-white transition-opacity"
            :class="zoom > 1 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <button
              type="button"
              class="p-1 rounded hover:bg-white/15"
              :class="showGuides ? 'bg-emerald-500/40' : ''"
              :aria-pressed="showGuides"
              title="Safe-area guide: where Shorts, Reels and TikTok keep clear for their own buttons"
              aria-label="Safe-area guide"
              @click="showGuides = !showGuides"
            >
              <UIcon name="i-lucide-frame" class="w-4 h-4 block" />
            </button>
            <button
              type="button"
              class="p-1 rounded hover:bg-white/15 disabled:opacity-40"
              aria-label="Zoom out"
              :disabled="zoom <= 1"
              @click="zoomBy(1 / 1.25)"
            >
              <UIcon name="i-lucide-zoom-out" class="w-4 h-4 block" />
            </button>
            <button
              type="button"
              class="px-1 text-xs font-medium tabular-nums min-w-11 rounded hover:bg-white/15"
              title="Reset zoom (scroll over the video to zoom)"
              @click="resetZoom"
            >
              {{ Math.round(zoom * 100) }}%
            </button>
            <button
              type="button"
              class="p-1 rounded hover:bg-white/15 disabled:opacity-40"
              aria-label="Zoom in"
              :disabled="zoom >= MAX_ZOOM"
              @click="zoomBy(1.25)"
            >
              <UIcon name="i-lucide-zoom-in" class="w-4 h-4 block" />
            </button>
          </div>
        </div>
        <EditorTransport
          :player="preview"
          :selection="mode === 'trim' ? range : mode === 'audio' ? audioEdit.state.range : null"
          :fullscreen-target="stage"
          :space-taken="hovering && zoom > 1"
          :arrow-keys-taken="mode === 'overlay' && !!overlayEdit.state.selectedId"
          :style="fitStyle"
        />
        <AudioStrip
          v-if="mode === 'audio'"
          :edit="audioEdit"
          :video-id="video.id"
          :duration-ms="durationMs"
          :current-ms="currentMs"
          :style="fitStyle"
          @seek="(ms: number) => preview?.seek(ms, false)"
        />
        <p v-if="!stageFullscreen && tabKeysHint" class="text-xs text-gray-500 dark:text-gray-400" data-testid="tab-keys-hint">
          <UIcon name="i-lucide-keyboard" class="w-3 h-3 inline align-text-top" /> {{ tabKeysHint }}
        </p>
        <p v-if="!stageFullscreen" class="text-xs text-gray-500 dark:text-gray-400">
          Drag on the video to crop · scroll over it to zoom · more shortcuts under
          <UIcon name="i-lucide-keyboard" class="w-3 h-3 inline align-text-top" /> above, or press <UKbd value="?" />
        </p>
      </div>

      <!-- Controls -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <!-- The tile takes the colour of the tool that is open, so the header says which one it is -->
              <span class="flex size-6 items-center justify-center rounded-md transition-colors" :class="TAB_ACCENTS[mode].soft">
                <UIcon name="i-lucide-sliders-horizontal" class="size-3.5" />
              </span>
              Edit
              <UBadge
                v-if="runningCount"
                size="sm"
                color="info"
                variant="subtle"
                icon="i-lucide-loader"
                :ui="{ leadingIcon: 'animate-spin motion-reduce:animate-none' }"
                data-testid="running-chip"
              >
                {{ runningCount }} running
              </UBadge>
            </h2>
            <div class="flex items-center gap-1">
              <span
                v-if="history.draftSavedAt.value"
                class="mr-1 hidden items-center gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex"
                data-testid="draft-saved"
                aria-live="polite"
              >
                <UIcon name="i-lucide-cloud-check" class="size-3.5" />
                Draft saved {{ draftSavedLabel }}
              </span>
              <UPopover v-model:open="recipesOpen">
                <UButton size="xs" color="neutral" variant="soft" :class="HEADER_TONES.recipes" icon="i-lucide-chef-hat" title="Reuse a look on this video"
                  >Recipes</UButton
                >
                <template #content>
                  <div class="w-80 space-y-3 p-3">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      A recipe keeps the crop shape and size, the sound settings and the text layers — not the trim, splits or sound clips, which belong to one
                      video.
                    </p>
                    <ul
                      v-if="recipes.saved.value.length"
                      class="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
                    >
                      <li v-for="r in recipes.saved.value" :key="r.id" class="flex items-center gap-2 px-2.5 py-2">
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ r.name }}</p>
                          <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ describeRecipe(r.data) }}</p>
                        </div>
                        <UButton size="xs" color="neutral" :class="TAB_ACCENTS.trim.button" @click="applyRecipe(r.data, r.name)">Apply</UButton>
                        <UButton
                          size="xs"
                          color="error"
                          variant="ghost"
                          icon="i-lucide-x"
                          :aria-label="`Delete recipe ${r.name}`"
                          @click="recipes.remove(r.id)"
                        />
                      </li>
                    </ul>
                    <p v-else class="text-xs text-gray-500 dark:text-gray-400">No recipes yet.</p>
                    <form class="space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800" @submit.prevent="onSaveRecipe">
                      <UFormField label="Save the current settings" :hint="currentRecipe ? describeRecipe(currentRecipe) : undefined">
                        <div class="flex items-center gap-2">
                          <UInput
                            v-model="recipeName"
                            size="sm"
                            class="min-w-0 flex-1"
                            placeholder="e.g. Reel look"
                            :maxlength="40"
                            :disabled="!currentRecipe"
                            aria-label="Recipe name"
                          />
                          <UButton type="submit" size="sm" icon="i-lucide-bookmark-plus" :disabled="!currentRecipe || !recipeName.trim()">Save</UButton>
                        </div>
                      </UFormField>
                      <p v-if="!currentRecipe" class="text-xs text-gray-500 dark:text-gray-400">
                        Set a crop and size, change the sound or add a text layer first.
                      </p>
                    </form>
                  </div>
                </template>
              </UPopover>
              <UButton
                size="xs"
                color="neutral"
                :variant="history.undoable.value ? 'soft' : 'ghost'"
                :class="history.undoable.value ? HEADER_TONES.history : ''"
                icon="i-lucide-undo-2"
                :disabled="!history.undoable.value"
                title="Undo (Ctrl/⌘+Z)"
                @click="history.undo()"
              >
                Undo
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                :variant="history.redoable.value ? 'soft' : 'ghost'"
                :class="history.redoable.value ? HEADER_TONES.history : ''"
                icon="i-lucide-redo-2"
                :disabled="!history.redoable.value"
                title="Redo (Ctrl/⌘+Shift+Z)"
                @click="history.redo()"
              >
                Redo
              </UButton>
              <ShortcutsHelp :items="EDITOR_SHORTCUTS" />
            </div>
          </div>
        </template>
        <!-- Short labels + stacked icons so all four tabs fit the narrow panel; the full names are in the tooltip. -->
        <UTabs
          v-model="mode"
          :items="tabItems"
          variant="link"
          :ui="{ list: 'mb-4', trigger: 'flex-1 flex-col gap-1 px-1 text-xs', leadingIcon: 'size-5', label: 'truncate', indicator: TAB_TONES[mode].indicator }"
        >
          <!-- ── Trim & crop ───────────────────────────────────────────── -->
          <template #trim>
            <div class="space-y-5" :class="TAB_ACCENTS.trim.scope">
              <!-- Range -->
              <section class="space-y-3" aria-labelledby="trim-range-h">
                <div class="flex items-center justify-between gap-2">
                  <h3 id="trim-range-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.trim.heading">Range</h3>
                  <UButton
                    v-if="trimDirty"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-rotate-ccw"
                    title="Undoable — Ctrl/⌘+Z brings the settings back"
                    @click="resetTrim"
                  >
                    Reset trim
                  </UButton>
                </div>
                <div class="flex items-end justify-between gap-3">
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Clip length</p>
                    <p class="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white" data-testid="clip-length">
                      {{ formatMsShort(range[1] - range[0]) }}
                    </p>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums text-right">
                    {{ formatMsShort(range[0]) }} – {{ formatMsShort(range[1]) }}<br />
                    of {{ formatMsShort(durationMs) }}
                  </p>
                </div>
                <USlider
                  v-model="range"
                  :min="0"
                  :max="Math.max(durationMs, 1)"
                  :step="100"
                  :min-steps-between-thumbs="500"
                  :ui="{ thumb: 'size-5' }"
                  aria-label="Trim range"
                />
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div v-for="edge in TRIM_EDGES" :key="edge.key" class="space-y-1">
                    <label :for="`trim-${edge.key}`" class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ edge.label }}</label>
                    <div class="flex items-center gap-1">
                      <UButton size="xs" color="neutral" variant="soft" aria-label="1 second earlier" @click="nudgeEdge(edge.key, -1000)">−1s</UButton>
                      <UInput
                        :id="`trim-${edge.key}`"
                        :model-value="formatTimecode(range[edge.key === 'start' ? 0 : 1])"
                        size="sm"
                        class="flex-1 min-w-0"
                        :ui="{ base: 'tabular-nums text-center' }"
                        inputmode="decimal"
                        @change="(e: Event) => typeEdge(edge.key, e)"
                        @keydown.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
                      />
                      <UButton size="xs" color="neutral" variant="soft" aria-label="1 second later" @click="nudgeEdge(edge.key, 1000)">+1s</UButton>
                    </div>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="link"
                      icon="i-lucide-crosshair"
                      :padded="false"
                      @click="setEdge(edge.key, Math.round(currentMs))"
                    >
                      Use current time
                    </UButton>
                  </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">Type a time like 1:23.5, or step by single frames with ← → under the video.</p>
              </section>

              <!-- Output -->
              <section class="space-y-3" aria-labelledby="trim-output-h">
                <h3 id="trim-output-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.trim.heading">Output</h3>
                <div>
                  <div class="mb-1.5 flex items-center justify-between gap-2">
                    <p class="text-xs text-gray-500 dark:text-gray-400">Export for</p>
                    <USwitch v-model="multiExport" size="xs" label="Several formats at once" @update:model-value="multiKeys = []" />
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Export presets">
                    <div v-for="p in EXPORT_PRESETS" :key="p.key" class="group relative">
                      <button
                        type="button"
                        :aria-pressed="isPresetOn(p)"
                        class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary-500"
                        :class="
                          isPresetOn(p)
                            ? [presetTone(p).active, 'ring-1']
                            : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                        "
                        @click="onPresetClick(p)"
                      >
                        <span class="relative flex size-8 shrink-0 items-center justify-center rounded-md" :class="presetTone(p).icon">
                          <UIcon :name="p.icon" class="w-4 h-4" />
                          <UIcon
                            v-if="multiExport && isPresetOn(p)"
                            name="i-lucide-circle-check"
                            class="absolute -right-1 -top-1 size-4 rounded-full bg-white dark:bg-gray-900"
                          />
                        </span>
                        <span class="min-w-0" :class="p.customId ? 'pr-14' : ''">
                          <span class="block text-sm font-medium truncate" :title="p.label">{{ p.label }}</span>
                          <span class="block text-xs opacity-70 tabular-nums">{{ p.ratio }} · {{ p.w }}×{{ p.h }}</span>
                        </span>
                      </button>
                      <div
                        v-if="p.customId"
                        class="absolute right-1 top-1 flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <UPopover :open="renamingId === p.customId" @update:open="(o: boolean) => (o ? startRename(p) : (renamingId = null))">
                          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" :aria-label="`Rename preset ${p.label}`" />
                          <template #content>
                            <form class="w-64 space-y-2 p-3" @submit.prevent="onRenamePreset(p)">
                              <UFormField label="Rename preset" :hint="`${renameText.length}/${MAX_PRESET_NAME}`">
                                <UInput
                                  ref="renameInput"
                                  v-model="renameText"
                                  size="sm"
                                  class="w-full"
                                  :maxlength="MAX_PRESET_NAME"
                                  aria-label="New preset name"
                                />
                              </UFormField>
                              <p v-if="renameClash(p)" class="text-xs text-warning-600 dark:text-warning-400">Taken — it will be “{{ renameClash(p) }}”.</p>
                              <div class="flex justify-end gap-1.5">
                                <UButton size="sm" color="neutral" variant="ghost" @click="renamingId = null">Cancel</UButton>
                                <UButton
                                  size="sm"
                                  type="submit"
                                  icon="i-lucide-check"
                                  color="neutral"
                                  :class="TAB_ACCENTS.trim.button"
                                  :disabled="!renameText.trim()"
                                  >Save</UButton
                                >
                              </div>
                            </form>
                          </template>
                        </UPopover>
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-x"
                          :aria-label="`Delete preset ${p.label}`"
                          @click="removePreset(p)"
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="multiExport"
                    class="mt-2 space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2.5 dark:border-sky-900 dark:bg-sky-950/40"
                    data-testid="multi-export"
                  >
                    <p class="text-xs text-sky-800 dark:text-sky-200">{{ multiSummary }}</p>
                    <UButton
                      v-if="canWrite"
                      size="sm"
                      block
                      color="neutral"
                      icon="i-lucide-layers"
                      :class="TAB_ACCENTS.trim.button"
                      :loading="startingMulti"
                      :disabled="!!multiError || starting"
                      @click="onStartMulti"
                    >
                      Queue {{ multiKeys.length }} export{{ multiKeys.length === 1 ? '' : 's' }}
                    </UButton>
                    <p v-if="multiError && multiKeys.length" class="text-xs text-error-600 dark:text-error-400">{{ multiError }}</p>
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <UPopover v-model:open="savingPreset">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-bookmark-plus"
                        :class="
                          presetToSave ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900' : ''
                        "
                        :disabled="!presetToSave"
                        @click="openSavePreset"
                      >
                        Save as preset
                      </UButton>
                      <template #content>
                        <form class="w-72 space-y-2.5 p-3" @submit.prevent="onSavePreset">
                          <div
                            v-if="presetToSave"
                            class="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                          >
                            <span
                              class="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
                            >
                              <UIcon name="i-lucide-bookmark" class="w-4 h-4" />
                            </span>
                            <span class="tabular-nums font-medium">{{ ratioLabel(presetToSave.aspect) }} · {{ presetToSave.w }}×{{ presetToSave.h }}</span>
                          </div>
                          <UFormField label="Name" :hint="`${presetName.length}/${MAX_PRESET_NAME}`">
                            <UInput
                              ref="presetNameInput"
                              v-model="presetName"
                              size="sm"
                              class="w-full"
                              placeholder="e.g. Instagram portrait"
                              :maxlength="MAX_PRESET_NAME"
                              aria-label="Preset name"
                            />
                          </UFormField>
                          <p v-if="presetRenamedTo" class="text-xs text-warning-600 dark:text-warning-400">
                            A preset with that name exists — this one will be saved as “{{ presetRenamedTo }}”.
                          </p>
                          <p v-else-if="presetsFull" class="text-xs text-warning-600 dark:text-warning-400">
                            You have {{ MAX_NAMED_ENTRIES }} saved presets — the oldest one is dropped to make room.
                          </p>
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-xs text-gray-500 dark:text-gray-400">Kept for all your videos.</span>
                            <div class="flex gap-1.5">
                              <UButton size="sm" color="neutral" variant="ghost" @click="savingPreset = false">Cancel</UButton>
                              <UButton
                                size="sm"
                                type="submit"
                                icon="i-lucide-check"
                                color="neutral"
                                class="bg-amber-500 text-white hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-gray-950 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                                :disabled="!presetName.trim()"
                              >
                                Save
                              </UButton>
                            </div>
                          </div>
                        </form>
                      </template>
                    </UPopover>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-download"
                      title="Save your presets to a file, to share or keep"
                      :disabled="!exportPresets.saved.value.length"
                      @click="onExportPresets"
                    >
                      Export
                    </UButton>
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-upload" title="Add presets from a file" @click="presetFileInput?.click()">
                      Import
                    </UButton>
                    <input
                      ref="presetFileInput"
                      type="file"
                      accept="application/json,.json"
                      class="sr-only"
                      tabindex="-1"
                      aria-hidden="true"
                      @change="onImportPresets"
                    />
                    <span v-if="!presetToSave && !activePreset" class="text-xs text-gray-500 dark:text-gray-400">
                      To save your own, turn on crop and resize and pick a shape such as 16:9.
                    </span>
                  </div>
                </div>

                <USwitch v-model="cropOn" label="Also crop" description="Keep only part of the picture." @update:model-value="onCropToggle" />
                <template v-if="cropOn">
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Drag on the video to draw the area to keep — drag inside it to move, drag the white handles to resize. Use the playback bar under the video
                    (or the trim handles above) to check other frames.
                  </p>
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="text-xs text-gray-500 mr-1">Shape</span>
                    <UButton
                      v-for="a in ASPECTS"
                      :key="a.label"
                      size="xs"
                      color="neutral"
                      :variant="cropAspect === a.value ? 'soft' : 'ghost'"
                      :class="cropAspect === a.value ? TAB_ACCENTS.trim.soft : ''"
                      @click="setAspect(a.value)"
                    >
                      {{ a.label }}
                    </UButton>
                    <UButton
                      v-if="cropAspect"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-scan-face"
                      :loading="autoCentering"
                      class="ml-auto"
                      title="Centre the crop on wherever the video moves the most"
                      @click="onAutoCenter"
                    >
                      Auto-center
                    </UButton>
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-maximize" :class="cropAspect ? '' : 'ml-auto'" @click="cropFull"
                      >Whole frame</UButton
                    >
                  </div>
                </template>
                <EditorSection
                  v-if="cropOn"
                  v-model:open="cropFieldsOpen"
                  title="Exact crop values"
                  :hint="crop.w && crop.h ? `${crop.w}×${crop.h} at ${crop.x}, ${crop.y}` : 'not drawn yet'"
                >
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <UFormField label="X"><UInput v-model.number="crop.x" type="number" size="sm" /></UFormField>
                    <UFormField label="Y"><UInput v-model.number="crop.y" type="number" size="sm" /></UFormField>
                    <UFormField label="Width"><UInput v-model.number="crop.w" type="number" size="sm" /></UFormField>
                    <UFormField label="Height"><UInput v-model.number="crop.h" type="number" size="sm" /></UFormField>
                  </div>
                </EditorSection>

                <USwitch
                  v-model="scaleOn"
                  label="Also resize the output"
                  description="Set the exact width and height of the result."
                  @update:model-value="onScaleToggle"
                />
                <div v-if="scaleOn" class="grid grid-cols-2 gap-2">
                  <UFormField label="Width"><UInput v-model.number="scale.w" type="number" size="sm" /></UFormField>
                  <UFormField label="Height"><UInput v-model.number="scale.h" type="number" size="sm" /></UFormField>
                </div>

                <!-- Turn and flip: done after the crop, before the resize -->
                <div class="space-y-1.5" role="group" aria-label="Turn and flip">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs text-gray-500 dark:text-gray-400">Turn and flip</p>
                    <UButton v-if="orientActive" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="orient = { ...NO_ORIENTATION }"
                      >Reset</UButton
                    >
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="soft"
                      :class="TAB_ACCENTS.trim.soft"
                      icon="i-lucide-rotate-ccw-square"
                      @click="orient = turned(orient, -1)"
                      >Left</UButton
                    >
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="soft"
                      :class="TAB_ACCENTS.trim.soft"
                      icon="i-lucide-rotate-cw-square"
                      @click="orient = turned(orient, 1)"
                      >Right</UButton
                    >
                    <UButton
                      size="xs"
                      color="neutral"
                      :variant="orient.flipH ? 'soft' : 'ghost'"
                      :class="orient.flipH ? TAB_ACCENTS.trim.soft : ''"
                      :aria-pressed="orient.flipH"
                      icon="i-lucide-flip-horizontal-2"
                      @click="orient = { ...orient, flipH: !orient.flipH }"
                    >
                      Flip left–right
                    </UButton>
                    <UButton
                      size="xs"
                      color="neutral"
                      :variant="orient.flipV ? 'soft' : 'ghost'"
                      :class="orient.flipV ? TAB_ACCENTS.trim.soft : ''"
                      :aria-pressed="orient.flipV"
                      icon="i-lucide-flip-vertical-2"
                      @click="orient = { ...orient, flipV: !orient.flipV }"
                    >
                      Flip top–bottom
                    </UButton>
                    <!-- What the picture will look like: an F turned and flipped the same way -->
                    <span
                      class="ml-auto flex size-9 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-lg font-bold text-sky-700 dark:border-gray-800 dark:bg-gray-900 dark:text-sky-300"
                      title="A sample letter turned and flipped the way your picture will be"
                      aria-hidden="true"
                    >
                      <span class="inline-block transition-transform motion-reduce:transition-none" :style="{ transform: orientSampleTransform }">F</span>
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{
                      orientActive
                        ? `${describeOrientation(orient)}. The crop is drawn on the picture as it is now.`
                        : 'For a video filmed sideways or a mirrored webcam.'
                    }}
                  </p>
                </div>
              </section>

              <!-- Action: says what will be made before it is made -->
              <section class="sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-4" :class="TAB_ACCENTS.trim.divider" aria-label="Start trim">
                <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="trim-summary">{{ trimSummary }}</p>
                <p v-if="trimSizeHint" class="text-xs text-gray-500 dark:text-gray-400" data-testid="trim-size-hint">{{ trimSizeHint }}</p>
                <!-- Always takes its line, so the layout (and the video) don't jump while a crop is being drawn. -->
                <p class="text-xs min-h-4" :class="trimError ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'">
                  {{ trimError ?? (trimDirty ? '' : 'Change the range, or turn on crop or resize, to make a trim.') }}
                </p>
                <UButton
                  v-if="canWrite"
                  block
                  color="neutral"
                  :class="TAB_ACCENTS.trim.button"
                  icon="i-lucide-scissors"
                  :loading="starting"
                  :disabled="!!trimError || !trimDirty || busy"
                  @click="onStartTrim"
                >
                  Start trim
                </UButton>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  The result appears under Results, where you can replace the original (kept under Versions) or add it as a new video.
                </p>
              </section>
            </div>
          </template>

          <!-- ── Split into segments ──────────────────────────────────────── -->
          <template #split>
            <div class="space-y-4" :class="TAB_ACCENTS.split.scope">
              <!-- Strip: click a segment to select it and jump the video to its start -->
              <section class="space-y-2" aria-labelledby="split-strip-h">
                <div class="flex items-center justify-between gap-2">
                  <h3 id="split-strip-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.split.heading">Segments</h3>
                  <UButton
                    v-if="splitDirty"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-rotate-ccw"
                    title="Undoable — Ctrl/⌘+Z brings the segments back"
                    @click="resetSplit"
                  >
                    Reset split
                  </UButton>
                </div>
                <div
                  v-if="durationMs"
                  ref="segmentStrip"
                  class="relative h-8 [@media(pointer:coarse)]:h-12 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden"
                >
                  <button
                    v-for="(bar, i) in segmentBars"
                    :key="i"
                    type="button"
                    class="absolute inset-y-0 flex items-center justify-center text-[11px] font-medium text-white border-r border-white dark:border-gray-900 last:border-r-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
                    :class="[bar.valid ? bar.color : 'bg-error-500', selectedSegment === i ? 'ring-2 ring-inset ring-white' : 'opacity-80 hover:opacity-100']"
                    :style="{ left: bar.leftPct + '%', width: bar.widthPct + '%' }"
                    :aria-label="`Segment ${i + 1}`"
                    @click="selectSegment(i)"
                  >
                    {{ i + 1 }}
                  </button>
                  <!-- Drag a shared boundary to move the cut (arrow keys nudge it) -->
                  <template v-for="(_, i) in segments" :key="`cut-${i}`">
                    <button
                      v-if="boundaryAfter(segments, i) !== null"
                      type="button"
                      class="absolute inset-y-0 w-3 -ml-1.5 [@media(pointer:coarse)]:w-6 [@media(pointer:coarse)]:-ml-3 cursor-col-resize touch-none flex items-center justify-center focus-visible:outline-2 focus-visible:outline-white"
                      :style="{ left: `${((boundaryAfter(segments, i)! * 1000) / durationMs) * 100}%` }"
                      :aria-label="`Move the cut between segments ${i + 1} and ${i + 2}`"
                      @pointerdown.prevent="(e: PointerEvent) => dragBoundary(i, e)"
                      @keydown.left.prevent="nudgeBoundary(i, -1, $event.shiftKey)"
                      @keydown.right.prevent="nudgeBoundary(i, 1, $event.shiftKey)"
                    >
                      <span class="h-4 w-1 rounded bg-white/90 shadow" />
                    </button>
                  </template>
                  <!-- Playhead -->
                  <span
                    class="absolute inset-y-0 w-0.5 bg-black/70 dark:bg-white/80 pointer-events-none"
                    :style="{ left: `${Math.min(100, (currentMs / durationMs) * 100)}%` }"
                  />
                </div>
                <p v-if="uncoveredMs > 0 && !splitError" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatMsShort(uncoveredMs) }} of the video isn't in any segment and will be left out.
                </p>
              </section>

              <!-- Rows: typed times (1:23 or 1:23.5), length, remove -->
              <section class="space-y-1.5" aria-label="Segment times">
                <div
                  v-for="(seg, i) in segments"
                  :key="i"
                  class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1.5 py-1 -mx-1.5"
                  :class="[
                    selectedSegment === i ? TAB_ACCENTS.split.selected : '',
                    rowProblem(seg) ? 'ring-1 ring-inset ring-error-400 bg-error-50/60 dark:bg-error-950/30' : ''
                  ]"
                  :aria-current="selectedSegment === i ? 'true' : undefined"
                  :aria-invalid="rowProblem(seg) ? 'true' : undefined"
                  @focusin="selectedSegment = i"
                >
                  <span class="w-5 text-xs text-gray-500 tabular-nums dark:text-gray-400">{{ i + 1 }}</span>
                  <UInput
                    :model-value="formatTimecode(seg.startMsSeconds * 1000)"
                    size="sm"
                    class="w-24"
                    :ui="{ base: 'tabular-nums' }"
                    :aria-label="`Segment ${i + 1} start`"
                    @change="(e: Event) => typeSegment(i, 'start', e)"
                  />
                  <span class="text-xs text-gray-500 dark:text-gray-400">to</span>
                  <UInput
                    :model-value="seg.endMsSeconds == null ? '' : formatTimecode(seg.endMsSeconds * 1000)"
                    size="sm"
                    class="w-24"
                    placeholder="end"
                    :ui="{ base: 'tabular-nums' }"
                    :aria-label="`Segment ${i + 1} end`"
                    @change="(e: Event) => typeSegment(i, 'end', e)"
                  />
                  <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums ml-auto">{{ segmentLength(seg) }}</span>
                  <p v-if="rowProblem(seg)" class="basis-full pl-7 text-xs text-error-600 dark:text-error-400" role="alert">{{ rowProblem(seg) }}</p>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-x"
                    aria-label="Remove segment"
                    :disabled="segments.length <= 1"
                    @click="removeSegment(i)"
                  />
                </div>
              </section>

              <!-- Add -->
              <section class="space-y-2" aria-label="Add segments">
                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    :class="TAB_ACCENTS.split.button"
                    icon="i-lucide-scissors-line-dashed"
                    :disabled="!canSplitHere"
                    @click="splitAtPlayhead"
                    >Split at playhead</UButton
                  >
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="soft"
                    :class="TAB_ACCENTS.split.soft"
                    icon="i-lucide-plus"
                    @click="segments.push({ startMsSeconds: 0, endMsSeconds: null })"
                  >
                    Add segment
                  </UButton>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-gray-500">Split evenly:</span>
                  <UButton
                    v-for="n in [2, 3, 4, 5, 6, 8, 10]"
                    :key="n"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    :class="TAB_ACCENTS.split.soft"
                    :disabled="!durationMs || n > evenPartsMax"
                    :title="durationMs && n > evenPartsMax ? tooManyPartsHint : undefined"
                    @click="splitEvenly(n)"
                  >
                    {{ n }} parts
                  </UButton>
                  <form class="flex items-center gap-1" @submit.prevent="splitEvenly(customParts)">
                    <UInput
                      v-model.number="customParts"
                      type="number"
                      size="xs"
                      :min="2"
                      :max="evenPartsMax"
                      class="w-16"
                      aria-label="Number of equal parts"
                      :disabled="!durationMs"
                    />
                    <UButton
                      type="submit"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      :class="TAB_ACCENTS.split.button"
                      :disabled="!customPartsValid"
                      :title="customPartsValid ? undefined : tooManyPartsHint"
                    >
                      Split
                    </UButton>
                  </form>
                </div>
                <p v-if="evenPreview" class="text-xs text-gray-500 dark:text-gray-400">{{ evenPreview }}</p>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-gray-500">Or every</span>
                  <form class="flex items-center gap-1" @submit.prevent="splitEvery">
                    <UInput
                      v-model.number="everySeconds"
                      type="number"
                      size="xs"
                      :min="MIN_TRIM_MS / 1000"
                      class="w-20"
                      aria-label="Seconds per part"
                      :disabled="!durationMs"
                    />
                    <span class="text-xs text-gray-500">seconds</span>
                    <UButton type="submit" size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.split.button" :disabled="!everyRows.length"
                      >Split</UButton
                    >
                  </form>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Play to a moment and press “Split at playhead” (or S) to cut the segment there in two. Drag a cut on the strip to move it; [ and ] jump
                  between segments.
                </p>
              </section>

              <!-- Action -->
              <section class="sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-4" :class="TAB_ACCENTS.split.divider" aria-label="Start split">
                <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="split-summary">{{ splitSummary }}</p>
                <p v-if="splitSizeHint" class="text-xs text-gray-500 dark:text-gray-400">{{ splitSizeHint }}</p>
                <p class="text-xs min-h-4" :class="splitError ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'">
                  {{ splitError ?? (splitDirty ? '' : 'Add a split point, or use “Split evenly”, to make more than one segment.') }}
                </p>
                <UButton
                  v-if="canWrite"
                  block
                  color="neutral"
                  :class="TAB_ACCENTS.split.button"
                  icon="i-lucide-split"
                  :loading="starting"
                  :disabled="!!splitError || !splitDirty || busy"
                  @click="onStartSplit"
                >
                  Start split
                </UButton>
                <p class="text-xs text-gray-500 dark:text-gray-400">Each segment becomes a new video, disabled until you review and enable it.</p>
              </section>
            </div>
          </template>
          <!-- ── Audio ─────────────────────────────────────────────────── -->
          <template #overlay>
            <OverlayPanel
              :class="TAB_ACCENTS.overlay.scope"
              :edit="overlayEdit"
              :video-id="video.id"
              :duration-ms="durationMs"
              :current-ms="currentMs"
              :can-write="canWrite"
              :busy="busy"
              @queued="onQueued"
              @preview="(ms: number, play?: boolean) => preview?.seek(ms, play ?? true)"
            />
          </template>

          <template #audio>
            <AudioEditPanel
              :class="TAB_ACCENTS.audio.scope"
              :edit="audioEdit"
              :video-id="video.id"
              :duration-ms="durationMs"
              :current-ms="currentMs"
              :can-write="canWrite"
              :busy="busy"
              @queued="onQueued"
            />
          </template>

          <template #join>
            <JoinPanel :class="TAB_ACCENTS.join.scope" :video="video" :edit="joinEdit" :can-write="canWrite" />
          </template>
        </UTabs>
      </UCard>
    </div>

    <!-- Results: jobs in progress (or the latest failure), then clips awaiting a decision -->
    <UCard ref="resultsCard" :class="TAB_ACCENTS.audio.scope" :ui="{ body: 'space-y-3', header: TAB_ACCENTS.audio.header }">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-list-checks" class="size-4" :class="TAB_ACCENTS.audio.icon" />
          <h2 class="font-semibold text-gray-900 dark:text-white">Results</h2>
          <UBadge v-if="data?.clips.length" color="neutral" variant="subtle" size="sm">{{ data.clips.length }}</UBadge>
          <AnimationSpeed v-if="visibleJobs.length" class="ml-auto" />
        </div>
      </template>

      <div
        v-for="job in visibleJobs"
        :key="job.id"
        class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2"
        :class="job.status === 'RUNNING' ? 'render-card text-gray-900 dark:text-white' : ''"
      >
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="font-medium text-gray-900 dark:text-white truncate">{{ jobLabel(job) }}</span>
          <div class="flex items-center gap-2">
            <UButton
              v-if="canCancel && isActiveJobStatus(job.status)"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-circle-stop"
              :loading="cancellingId === job.id"
              :aria-label="`Cancel ${jobLabel(job)}`"
              @click="onCancelJob(job)"
            >
              Cancel
            </UButton>
            <UButton size="xs" color="neutral" variant="link" :to="`/processing-jobs/${job.id}`" :padded="false">Job #{{ job.id }}</UButton>
          </div>
        </div>
        <RenderAnimation v-if="isActiveJobStatus(job.status)" :operation="jobOperation(job)" :status="job.status" />
        <JobProgress
          :status="job.status"
          :progress="job.progress"
          :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep"
          :queue-position="job.queuePosition"
        />
      </div>

      <EmptyState
        v-if="!visibleJobs.length && !data?.clips.length"
        icon="i-lucide-clapperboard"
        title="Nothing yet"
        description="Start a trim, split or audio edit — the results appear here to preview, then replace the original or add as new videos."
        class="py-6"
      />

      <div v-if="canWrite && selectableClips.length > 1" class="flex flex-wrap items-center gap-2 text-sm">
        <UCheckbox :model-value="allClipsPicked" label="Select all" @update:model-value="pickAllClips" />
        <template v-if="pickedClips.length">
          <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{{ pickedClips.length }} selected</span>
          <UButton size="xs" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-copy-plus" :loading="bulkBusy" @click="onBulkAddAsNew"
            >Add as new videos</UButton
          >
          <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :disabled="bulkBusy" @click="confirmBulkDiscard = true">Discard</UButton>
        </template>
      </div>

      <ul v-if="data?.clips.length" class="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
        <li v-for="clip in data.clips" :key="clip.id" class="flex items-center gap-3 px-3 py-2" :class="freshClipIds.includes(clip.id) ? 'result-in' : ''">
          <UCheckbox
            v-if="canWrite && selectableClips.length > 1 && clip.operation !== 'EXTRACT'"
            :model-value="pickedClipIds.includes(clip.id)"
            :aria-label="`Select ${clipTitle(clip)}`"
            @update:model-value="(v: boolean | 'indeterminate') => pickClip(clip.id, v === true)"
          />
          <span
            class="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shrink-0"
          >
            <UIcon :name="CLIP_ICONS[clip.operation]" class="w-4 h-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ clipTitle(clip) }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              <template v-if="clip.summary">{{ clip.summary }} · </template>
              {{ formatFileSize(clip.sizeBytes) }}
              <template v-if="clip.crop"> · cropped {{ clip.crop.w }}×{{ clip.crop.h }}</template>
              <template v-if="clip.scale"> · resized {{ clip.scale.w }}×{{ clip.scale.h }}</template>
              · expires {{ formatTimeUntil(clip.expiresAt) }}
            </p>
            <audio v-if="clip.operation === 'EXTRACT'" :src="clip.url" controls preload="none" class="mt-1 h-8 w-full max-w-sm" />
          </div>
          <template v-if="clip.operation === 'EXTRACT'">
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-download" :href="clip.url" download>Download</UButton>
          </template>
          <template v-else>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-play" @click="previewClip = clip">Preview</UButton>
            <UButton v-if="video.videoUrl" size="xs" color="neutral" variant="ghost" icon="i-lucide-columns-2" @click="compareClip = clip">Compare</UButton>
            <template v-if="canWrite">
              <!-- A trim, audio or overlay result can be kept as a separate video, leaving the original as it is -->
              <!-- The safe choice is the solid button; replacing (which asks to confirm) is the quieter one. -->
              <UButton v-if="replaces(clip)" size="xs" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-copy-plus" @click="openAsNew(clip)"
                >Add as new video</UButton
              >
              <UButton size="xs" :color="replaces(clip) ? 'warning' : 'primary'" :variant="replaces(clip) ? 'soft' : 'solid'" @click="confirmPromote = clip">
                {{ replaces(clip) ? 'Replace original' : 'Add as new video' }}
              </UButton>
            </template>
          </template>
          <UButton
            v-if="canWrite"
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            aria-label="Discard clip"
            @click="confirmDiscardClip = clip"
          />
        </li>
      </ul>
    </UCard>

    <ClipPreviewModal
      :open="previewClip !== null"
      :clip="previewClip"
      :title="previewClip ? clipTitle(previewClip) : ''"
      :can-write="canWrite"
      :replaces="previewClip ? replaces(previewClip) : false"
      :can-compare="!!video.videoUrl"
      :poster="video.thumbnailUrl"
      @update:open="(v: boolean) => !v && (previewClip = null)"
      @add-new="onPreviewAddNew"
      @replace="previewClip && (confirmPromote = previewClip)"
      @compare="previewClip && (compareClip = previewClip)"
      @discard="previewClip && (confirmDiscardClip = previewClip)"
    />

    <ClipCompareModal
      :open="compareClip !== null"
      :clip="compareClip"
      :original-url="video.videoUrl"
      @update:open="(v: boolean) => !v && (compareClip = null)"
    />

    <ConfirmModal
      :model-value="confirmBulkDiscard"
      :title="`Discard ${pickedClips.length} result${pickedClips.length === 1 ? '' : 's'}?`"
      description="The rendered files are deleted, and they can't be replaced or added as videos afterwards. Your original video is not affected."
      confirm-label="Discard"
      color="error"
      :loading="bulkBusy"
      @update:model-value="(v: boolean) => (confirmBulkDiscard = v)"
      @confirm="onBulkDiscard"
    />

    <UModal
      :open="asNewClip !== null"
      title="Add as a new video"
      description="Makes a separate video from this result. Your original video is not changed, and the new one stays hidden until you enable it."
      @update:open="(v: boolean) => !v && !creatingNew && (asNewClip = null)"
    >
      <template #body>
        <form id="as-new-form" class="space-y-3" @submit.prevent="onCreateNew">
          <UFormField label="Title" required>
            <UInput v-model="asNewTitle" maxlength="200" class="w-full" autofocus aria-label="Title of the new video" />
          </UFormField>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="creatingNew" @click="close">Cancel</UButton>
          <UButton type="submit" form="as-new-form" icon="i-lucide-copy-plus" :loading="creatingNew" :disabled="!asNewTitle.trim()">Create video</UButton>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmPromote !== null"
      :title="confirmPromote && replaces(confirmPromote) ? 'Replace the original video' : 'Add as a new video'"
      :description="
        confirmPromote && replaces(confirmPromote)
          ? `This replaces the video's current file with ${confirmPromote.operation === 'AUDIO' ? 'the version with the edited sound' : confirmPromote.operation === 'OVERLAY' ? 'the version with the text & overlays' : 'this trimmed/cropped clip'}. The current file is kept under Versions, so you can restore it.`
          : 'Creates a new, disabled video from this segment — review it before enabling it for learners.'
      "
      :confirm-label="confirmPromote && replaces(confirmPromote) ? 'Replace original' : 'Add as new video'"
      :color="confirmPromote && replaces(confirmPromote) ? 'warning' : 'primary'"
      :loading="promoting"
      @update:model-value="(v: boolean) => !v && !promoting && (confirmPromote = null)"
      @confirm="onPromote"
    />

    <ConfirmModal
      :model-value="confirmDiscardClip !== null"
      title="Discard this result"
      :description="`Discard “${confirmDiscardClip ? clipTitle(confirmDiscardClip) : ''}”? The rendered file is deleted, and it can't be replaced or added as a video afterwards. Your original video is not affected.`"
      confirm-label="Discard"
      color="error"
      @update:model-value="(v: boolean) => !v && (confirmDiscardClip = null)"
      @confirm="onConfirmDiscardClip"
    />

    <ConfirmModal
      :model-value="confirmDiscardDraft"
      title="Discard unrendered edits"
      description="These were only kept in this browser and haven't been rendered yet. Discarding them can't be undone."
      confirm-label="Discard"
      color="error"
      @update:model-value="(v: boolean) => (confirmDiscardDraft = v)"
      @confirm="onDiscardDraft"
    />
  </div>
</template>

<script setup lang="ts">
// The video editor (its own page, /videos/:id/editor): trim/crop/scale a
// range of a video, split it into segments, or edit its sound — all run as
// EDIT jobs (useVideoEdits), producing clips to preview, then promote (TRIM
// and AUDIO replace the video's file; SPLIT segments become new videos),
// download (extracted audio) or discard. Polls jobs
// while any are active, same pattern as VideoDownloadModal.
import type { EditOverview, VideoClip } from '~/composables/useVideoEdits'
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import type { Video } from '~/composables/useVideos'
import type VideoPlayer from '~/components/VideoPlayer.vue'
import {
  boundaryAfter,
  centeredCrop,
  findSplitTarget,
  MAX_QUEUED_EDITS,
  NO_ORIENTATION,
  swapsSides,
  describeOrientation,
  hasOrientation,
  orientationRequest,
  turned,
  type Orientation,
  safeInsets,
  MAX_SEGMENTS,
  MIN_TRIM_MS,
  maxEvenParts,
  moveBoundary,
  splitEveryRows,
  splitEvenlyRows,
  splitRowAt,
  uncoveredMs as uncoveredTime,
  validateCrop,
  validateScale,
  validateSegments,
  suggestedNewTitle,
  validateTrim,
  withTrimEdge
} from '#shared/utils/videoEdit'
import { isMutedAt } from '#shared/utils/audioEdit'
import { formatTimecode, parseTimecode } from '#shared/utils/transport'
import { presetFromSettings, ratioLabel } from '#shared/utils/exportPreset'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { audioDifferences, describeRecipe, fullAudio, isRecipeEmpty, type EditRecipe, type RecipeLayer } from '#shared/utils/editRecipe'
import { MAX_NAMED_ENTRIES, uniqueName } from '#shared/utils/namedList'
import { formatFileSize, formatTimeUntil } from '#shared/utils/format'
import type { EditorDraft } from '~/composables/useEditorHistory'

const props = defineProps<{ video: Video; canWrite: boolean }>()
const emit = defineEmits<{ replaced: []; created: [videoId: number] }>()

const toast = useToast()
const { overview, startTrim, startSplit, autoCrop, promote, remove } = useVideoEdits()

const data = ref<EditOverview | null>(null)
const error = ref('')

// When a render with new audio finishes, say so and offer the next step right there.
function announceNewAudioClips(before: VideoClip[] | undefined, after: VideoClip[]) {
  if (!before) return
  const known = new Set(before.map((c) => c.id))
  const fresh = after.find((c) => c.operation === 'AUDIO' && !known.has(c.id))
  if (!fresh) return
  toast.add({
    title: 'Your video with the new audio is ready',
    description: 'Preview it under Results, then replace the original or add it as a new video.',
    color: 'success',
    duration: 10000,
    actions: props.canWrite ? [{ label: 'Add as new video', onClick: () => openAsNew(fresh) }] : []
  })
}
// A finished result slides in with a brief glow, then settles.
const freshClipIds = ref<number[]>([])
let freshTimer: ReturnType<typeof setTimeout> | undefined
function markFreshClips(before: VideoClip[] | undefined, after: VideoClip[]) {
  if (!before) return
  const known = new Set(before.map((c) => c.id))
  const fresh = after.filter((c) => !known.has(c.id)).map((c) => c.id)
  if (!fresh.length) return
  freshClipIds.value = fresh
  clearTimeout(freshTimer)
  freshTimer = setTimeout(() => (freshClipIds.value = []), 2000)
}
onBeforeUnmount(() => clearTimeout(freshTimer))
async function load() {
  error.value = ''
  try {
    const before = data.value?.clips
    data.value = await overview(props.video.id)
    markFreshClips(before, data.value.clips)
    announceNewAudioClips(before, data.value.clips)
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
}

// The Results card sits below a tall preview + controls grid — easy to miss
// that anything happened after clicking "Start trim" etc, especially once
// the layout stacks to a single column below the `xl` breakpoint.
const resultsCard = useTemplateRef<{ $el: HTMLElement }>('resultsCard')
function scrollToResults() {
  resultsCard.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
function onQueued() {
  load()
  scrollToResults()
}

const mode = ref<'trim' | 'split' | 'audio' | 'overlay' | 'join'>('trim')

// Colours of the buttons in the Edit header: Recipes in amber (like the saved presets), Undo/Redo in blue while there is something to undo or redo.
const HEADER_TONES = {
  recipes: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60',
  history: 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60'
}

// The keys that matter on the tab that is open.
const TAB_KEYS: Partial<Record<typeof mode.value, string>> = {
  trim: 'I set start · O set end · ← → step a frame · Space play',
  split: 'S split here · [ ] previous / next segment · drag a cut on the strip',
  audio: 'Space play · ← → step a frame · Ctrl/⌘ Z undo',
  overlay: 'Arrow keys nudge the layer (Shift = further) · Delete removes it'
}
const tabKeysHint = computed(() => TAB_KEYS[mode.value] ?? '')

const EDITOR_SHORTCUTS = [
  { keys: 'space', label: 'Play / pause' },
  { keys: 'K', label: 'Play / pause' },
  { keys: '←', label: 'Previous frame' },
  { keys: '→', label: 'Next frame' },
  { keys: 'shift ←', label: 'Back 10 seconds' },
  { keys: 'shift →', label: 'Forward 10 seconds' },
  { keys: 'J', label: 'Back 10 seconds' },
  { keys: 'L', label: 'Forward 10 seconds' },
  { keys: 'F', label: 'Full screen' },
  { keys: 'I', label: 'Set the trim start to the playhead (Trim tab)' },
  { keys: 'O', label: 'Set the trim end to the playhead (Trim tab)' },
  { keys: 'S', label: 'Split at the playhead (Split tab)' },
  { keys: '[  ]', label: 'Previous / next segment (Split tab)' },
  { keys: 'ctrl/⌘ Z', label: 'Undo' },
  { keys: 'ctrl/⌘ shift Z', label: 'Redo' },
  { keys: 'space (drag)', label: 'Move around when zoomed in' },
  { keys: '←→↑↓', label: 'Nudge the selected layer (Text tab)' },
  { keys: 'shift ←→↑↓', label: 'Nudge further' },
  { keys: 'delete', label: 'Remove the selected layer (Text tab)' }
]

// ── Preview player ───────────────────────────────────────────────────────────
const preview = useTemplateRef<InstanceType<typeof VideoPlayer>>('preview')
const currentMs = ref(0)
const durationMs = ref((props.video.durationSeconds ?? 0) * 1000)
const naturalWidth = ref(props.video.width ?? 0)
const naturalHeight = ref(props.video.height ?? 0)
function onTime(ms: number) {
  currentMs.value = ms
}
function onDuration(seconds: number) {
  durationMs.value = seconds * 1000
  if (range.value[1] === 0) range.value = [0, durationMs.value]
  const el = preview.value?.videoEl
  if (el?.videoWidth) naturalWidth.value = el.videoWidth
  if (el?.videoHeight) naturalHeight.value = el.videoHeight
  settle()
}

// ── Zoom & pan the preview ───────────────────────────────────────────────────
// A CSS transform on a wrapper (origin top-left): screen = pan + zoom × local.
const zoomBox = useTemplateRef<HTMLDivElement>('zoomBox')
const MAX_ZOOM = 6
const zoom = ref(1)
const pan = reactive({ x: 0, y: 0 })
const hovering = ref(false)
const spaceHeld = ref(false)
const panning = ref(false)
const cropActive = computed(() => mode.value === 'trim' && cropOn.value)

// Safe-area guide: over the crop box when one is drawn, else over the whole picture.
const showGuides = ref(false)
const guideBox = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value) return null
  const useCrop = cropOn.value && crop.w > 0 && crop.h > 0
  const box = useCrop ? crop : { x: 0, y: 0, w: naturalWidth.value, h: naturalHeight.value }
  const inset = safeInsets(box.w / box.h)
  const pct = (n: number) => `${n * 100}%`
  return {
    label: inset.bottom > 0.1 ? 'Shorts / Reels / TikTok safe area' : 'Safe area',
    style: {
      left: pct(box.x / naturalWidth.value),
      top: pct(box.y / naturalHeight.value),
      width: pct(box.w / naturalWidth.value),
      height: pct(box.h / naturalHeight.value)
    },
    safe: { left: pct(inset.left), top: pct(inset.top), right: pct(inset.right), bottom: pct(inset.bottom) }
  }
})

// Keeps the zoomed picture covering the frame — no panning off into empty space.
function clampPan() {
  const el = zoomBox.value
  if (!el) return
  pan.x = Math.min(0, Math.max(el.clientWidth * (1 - zoom.value), pan.x))
  pan.y = Math.min(0, Math.max(el.clientHeight * (1 - zoom.value), pan.y))
}
// Zooms keeping the point (sx, sy) — in frame coordinates — where it is on screen.
function zoomAt(factor: number, sx: number, sy: number) {
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom.value * factor))
  if (next === zoom.value) return
  pan.x = sx - ((sx - pan.x) * next) / zoom.value
  pan.y = sy - ((sy - pan.y) * next) / zoom.value
  zoom.value = next
  clampPan()
}
function zoomBy(factor: number) {
  const el = zoomBox.value
  if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
}
function resetZoom() {
  zoom.value = 1
  pan.x = 0
  pan.y = 0
}
function onPreviewWheel(e: WheelEvent) {
  // At 100%, scrolling "out" is left to the modal, so the page still scrolls normally.
  if (zoom.value <= 1 && e.deltaY > 0) return
  e.preventDefault()
  const r = zoomBox.value!.getBoundingClientRect()
  zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
}

// A drag that moved shouldn't also count as a click (which would play/pause the video).
function swallowNextClick() {
  const swallow = (ev: MouseEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
}

// Pans on Space+drag or middle-drag (plain drags are for cropping). Runs in
// the capture phase so it wins over the crop layer and the player.
function onPanStart(e: PointerEvent) {
  if (zoom.value <= 1) return
  if (e.button !== 1 && !(e.button === 0 && spaceHeld.value)) return
  e.preventDefault()
  e.stopPropagation()
  panning.value = true
  const start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  let moved = false
  const move = (ev: PointerEvent) => {
    moved ||= Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3
    pan.x = start.px + ev.clientX - start.x
    pan.y = start.py + ev.clientY - start.y
    clampPan()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener(
    'pointerup',
    () => {
      window.removeEventListener('pointermove', move)
      panning.value = false
      if (moved) swallowNextClick()
    },
    { once: true }
  )
}

// With crop off, dragging across the picture switches it on and draws the box
// — no need to find the switch first. A plain click still plays/pauses, and
// drags that start on the player's control bar are left to the player.
const cropLayer = useTemplateRef<{ beginDraw: (from: { clientX: number; clientY: number }, to?: PointerEvent) => void }>('cropLayer')
const CONTROL_BAR_PX = 56
function onQuickCropStart(e: PointerEvent) {
  if (e.button !== 0 || spaceHeld.value || mode.value !== 'trim' || cropOn.value) return
  const r = zoomBox.value!.getBoundingClientRect()
  if (e.clientY >= r.top + pan.y + zoom.value * (r.height - CONTROL_BAR_PX)) return
  const from = { clientX: e.clientX, clientY: e.clientY }
  const move = async (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - from.clientX, ev.clientY - from.clientY) < 6) return
    cleanup()
    cropOn.value = true
    await nextTick()
    cropLayer.value?.beginDraw(from, ev)
    window.addEventListener('pointerup', swallowNextClick, { once: true })
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', cleanup)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', cleanup, { once: true })
}

// Only text entry keeps its Space. A focused button (e.g. the "Also crop"
// switch just clicked) doesn't — Space must pan, not re-toggle it.
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
}
function onKeyDown(e: KeyboardEvent) {
  if (
    mode.value === 'trim' &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isTyping(e.target) &&
    !(e.target as HTMLElement | null)?.closest?.('[role="dialog"]')
  ) {
    if (e.key === 'i' || e.key === 'I' || e.key === 'o' || e.key === 'O') {
      e.preventDefault()
      setEdge(e.key.toLowerCase() === 'i' ? 'start' : 'end', Math.round(currentMs.value))
      return
    }
  }
  if (
    mode.value === 'split' &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isTyping(e.target) &&
    !(e.target as HTMLElement | null)?.closest?.('[role="dialog"]')
  ) {
    if (e.key === 's' || e.key === 'S') {
      if (canSplitHere.value) {
        e.preventDefault()
        splitAtPlayhead()
      }
      return
    }
    if (e.key === '[' || e.key === ']') {
      e.preventDefault()
      const last = segments.value.length - 1
      const next = e.key === ']' ? Math.min(last, (selectedSegment.value ?? -1) + 1) : Math.max(0, (selectedSegment.value ?? 1) - 1)
      selectSegment(next)
      return
    }
  }
  // Only when zoomed: otherwise Space plays/pauses (EditorTransport).
  if (e.code !== 'Space' || !hovering.value || zoom.value <= 1 || isTyping(e.target)) return
  e.preventDefault()
  spaceHeld.value = true
}
function onKeyUp(e: KeyboardEvent) {
  if (e.code !== 'Space' || !spaceHeld.value) return
  e.preventDefault()
  spaceHeld.value = false
}
// ── Full screen ──────────────────────────────────────────────────────────────
// The player keeps its 16:9 box, so in full screen it's sized to fit the
// height left over by the playback bar; the bar matches its width.
const stage = useTemplateRef<HTMLDivElement>('stage')
const stageFullscreen = ref(false)
const fitStyle = computed(() => (stageFullscreen.value ? { width: 'min(100%, calc((100vh - 7.5rem) * 16 / 9))', marginInline: 'auto' } : undefined))
function onFullscreenChange() {
  stageFullscreen.value = !!stage.value && document.fullscreenElement === stage.value
  nextTick(clampPan)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

// ── Trim & crop ────────────────────────────────────────────────────────────
const range = ref<[number, number]>([0, durationMs.value])
// Starts with no selection: the first drag on the video draws it. (A
// pre-made box covering most of the frame meant almost every press landed
// inside it and moved it instead.)
const cropOn = ref(false)
const crop = reactive({ x: 0, y: 0, w: 0, h: 0 })
function onCropToggle(on: boolean) {
  if (!on) {
    cropAspect.value = null
    Object.assign(crop, { x: 0, y: 0, w: 0, h: 0 })
  }
}

const ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 }
]
const cropAspect = ref<number | null>(null)
// Picking a shape fits the largest box of that shape, centred on the current crop.
function setAspect(aspect: number | null) {
  cropAspect.value = aspect
  if (!aspect || !naturalWidth.value || !naturalHeight.value) return
  const cx = crop.w ? crop.x + crop.w / 2 : naturalWidth.value / 2
  const cy = crop.h ? crop.y + crop.h / 2 : naturalHeight.value / 2
  Object.assign(crop, centeredCrop(aspect, naturalWidth.value, naturalHeight.value, cx, cy))
}
function cropFull() {
  cropAspect.value = null
  Object.assign(crop, { x: 0, y: 0, w: naturalWidth.value, h: naturalHeight.value })
}

// One-click sizing for common destinations: crop shape + output resolution together.
interface ExportPreset {
  key: string
  label: string
  ratio: string
  aspect: number
  w: number
  h: number
  icon: string
  /** Set on presets saved in this browser — only those can be deleted. */
  customId?: string
}
const BUILTIN_PRESETS: ExportPreset[] = [
  { key: 'youtube', label: 'YouTube 1080p', ratio: '16:9', aspect: 16 / 9, w: 1920, h: 1080, icon: 'i-simple-icons-youtube' },
  { key: 'shorts', label: 'Shorts / Reels / TikTok', ratio: '9:16', aspect: 9 / 16, w: 1080, h: 1920, icon: 'i-lucide-smartphone' },
  { key: 'square', label: 'Square', ratio: '1:1', aspect: 1, w: 1080, h: 1080, icon: 'i-lucide-square' },
  { key: 'twitter', label: 'Twitter/X', ratio: '16:9', aspect: 16 / 9, w: 1280, h: 720, icon: 'i-lucide-message-square' }
]
// Each destination gets its own accent so the buttons are easy to tell apart at a glance.
const PRESET_TONES: Record<string, { icon: string; active: string }> = {
  youtube: {
    icon: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
    active: 'border-red-500 ring-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
  },
  shorts: {
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    active: 'border-violet-500 ring-violet-500 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300'
  },
  square: {
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    active: 'border-emerald-500 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
  },
  twitter: {
    icon: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
    active: 'border-sky-500 ring-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
  }
}
const CUSTOM_PRESET_TONE = {
  icon: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  active: 'border-amber-500 ring-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
}
function presetTone(p: ExportPreset) {
  return PRESET_TONES[p.key] ?? CUSTOM_PRESET_TONE
}
const exportPresets = useExportPresets()
const EXPORT_PRESETS = computed<ExportPreset[]>(() => [
  ...BUILTIN_PRESETS,
  ...exportPresets.saved.value.map((e) => ({
    key: e.id,
    label: e.name,
    ratio: ratioLabel(e.data.aspect),
    ...e.data,
    icon: 'i-lucide-bookmark',
    customId: e.id
  }))
])
function applyPreset(preset: ExportPreset) {
  cropOn.value = true
  setAspect(preset.aspect)
  scaleOn.value = true
  Object.assign(scale, { w: preset.w, h: preset.h })
  toast.add({ title: `Crop and resize set for ${preset.label}`, color: 'info' })
}
// A preset counts as chosen while its crop shape and output size are what is set,
// so it un-highlights as soon as either is changed by hand.
const activePreset = computed(() =>
  cropOn.value && scaleOn.value ? (EXPORT_PRESETS.value.find((p) => p.aspect === cropAspect.value && p.w === scale.w && p.h === scale.h) ?? null) : null
)
// "Several formats at once": presets are ticked instead of applied, then one trim
// per tick is queued — same range, each with its own centred crop and size.
const multiExport = ref(false)
const multiKeys = ref<string[]>([])
const startingMulti = ref(false)
const multiPresets = computed(() => EXPORT_PRESETS.value.filter((p) => multiKeys.value.includes(p.key)))
function isPresetOn(p: ExportPreset) {
  return multiExport.value ? multiKeys.value.includes(p.key) : activePreset.value?.key === p.key
}
function onPresetClick(p: ExportPreset) {
  if (!multiExport.value) return togglePreset(p)
  multiKeys.value = multiKeys.value.includes(p.key) ? multiKeys.value.filter((k) => k !== p.key) : [...multiKeys.value, p.key]
}
// The server queues at most MAX_QUEUED_EDITS edits per video, so only that many formats fit (fewer while others are waiting).
const queueSlots = computed(() => Math.max(0, MAX_QUEUED_EDITS - runningCount.value))
const multiError = computed(() => {
  if (!multiKeys.value.length) return 'Tick the formats you want.'
  if (multiKeys.value.length > queueSlots.value) {
    return queueSlots.value
      ? `Only ${queueSlots.value} more ${queueSlots.value === 1 ? 'edit fits' : 'edits fit'} in the queue — untick ${multiKeys.value.length - queueSlots.value}.`
      : 'The queue is full — wait for an edit to finish.'
  }
  if (!naturalWidth.value || !naturalHeight.value) return 'Waiting for the video to load.'
  return validateTrim(Math.round(range.value[0]), Math.round(range.value[1]), Math.round(durationMs.value) || null)
})
const multiSummary = computed(() =>
  multiKeys.value.length
    ? `${multiKeys.value.length} new video${multiKeys.value.length === 1 ? '' : 's'}, each ${formatMsShort(range.value[1] - range.value[0])} long, cropped from the centre: ${multiPresets.value.map((p) => p.label).join(', ')}.`
    : 'Tick two or more formats above — each becomes its own result, cropped from the centre of the picture.'
)
async function onStartMulti() {
  if (multiError.value || startingMulti.value) return
  startingMulti.value = true
  let queued = 0
  try {
    for (const p of multiPresets.value) {
      await startTrim(props.video.id, {
        startMs: Math.round(range.value[0]),
        endMs: Math.round(range.value[1]),
        crop: centeredCrop(p.aspect, naturalWidth.value, naturalHeight.value),
        scale: { w: p.w, h: p.h }
      })
      queued++
    }
    toast.add({ title: `${queued} export${queued === 1 ? '' : 's'} queued`, color: 'success' })
    multiKeys.value = []
    scrollToResults()
  } catch (err) {
    const left = multiPresets.value
      .slice(queued)
      .map((p) => p.label)
      .join(', ')
    toast.add({
      title: queued ? `${queued} queued, then it stopped` : 'Could not queue the exports',
      description: `${apiErrorMessage(err)}${queued ? ` Not queued: ${left}.` : ''}`,
      color: 'error'
    })
  } finally {
    startingMulti.value = false
    await load()
  }
}

function togglePreset(preset: ExportPreset) {
  if (activePreset.value?.key !== preset.key) return applyPreset(preset)
  // Choosing the active preset again clears what it set.
  cropOn.value = false
  onCropToggle(false)
  scaleOn.value = false
}

// Saving the current crop shape + output size as a preset of your own.
const savingPreset = ref(false)
const presetName = ref('')
const MAX_PRESET_NAME = 40
const presetNameInput = useTemplateRef<{ inputRef?: HTMLInputElement }>('presetNameInput')
const presetToSave = computed(() => (activePreset.value ? null : presetFromSettings(cropOn.value, cropAspect.value, scaleOn.value, scale)))
const takenPresetNames = computed(() => [...BUILTIN_PRESETS.map((b) => b.label), ...exportPresets.saved.value.map((e) => e.name)])
// If the name is taken, the list adds "(2)" — say so before it happens.
const presetRenamedTo = computed(() => {
  const wanted = presetName.value.trim()
  if (!wanted) return ''
  const unique = uniqueName(wanted, takenPresetNames.value)
  return unique === wanted ? '' : unique
})
const presetsFull = computed(() => exportPresets.saved.value.length >= MAX_NAMED_ENTRIES)
function openSavePreset() {
  const data = presetToSave.value
  // A starting name that describes the shape, ready to be typed over.
  if (data && !presetName.value.trim()) presetName.value = `${ratioLabel(data.aspect)} ${data.w}×${data.h}`
  nextTick(() => {
    const el = presetNameInput.value?.inputRef
    el?.focus()
    el?.select()
  })
}
function onSavePreset() {
  const data = presetToSave.value
  const name = presetName.value.trim()
  if (!data || !name) return
  const finalName = uniqueName(name, takenPresetNames.value)
  exportPresets.save(finalName, data)
  toast.add({ title: `Saved preset “${finalName}”`, description: 'It is under Export for, ready to pick on any video.', color: 'success' })
  presetName.value = ''
  savingPreset.value = false
}
// Share saved presets as a small JSON file.
const presetFileInput = useTemplateRef<HTMLInputElement>('presetFileInput')
function onExportPresets() {
  const url = URL.createObjectURL(new Blob([exportPresets.exportJson()], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'export-presets.json'
  a.click()
  URL.revokeObjectURL(url)
}
async function onImportPresets(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const added = exportPresets.importJson(await file.text())
    toast.add(
      added
        ? { title: `Added ${added} preset${added === 1 ? '' : 's'}`, color: 'success' }
        : { title: 'Nothing new to add', description: 'You already have every preset in that file.', color: 'info' }
    )
  } catch (err) {
    toast.add({ title: 'Could not import presets', description: err instanceof Error ? err.message : undefined, color: 'error' })
  }
}

// Rename a saved preset in place.
const renamingId = ref<string | null>(null)
const renameText = ref('')
const renameInput = useTemplateRef<{ inputRef?: HTMLInputElement }>('renameInput')
function startRename(preset: ExportPreset) {
  renamingId.value = preset.customId ?? null
  renameText.value = preset.label
  nextTick(() => {
    const el = Array.isArray(renameInput.value) ? renameInput.value[0]?.inputRef : renameInput.value?.inputRef
    el?.focus()
    el?.select()
  })
}
function otherPresetNames(preset: ExportPreset) {
  return [...BUILTIN_PRESETS.map((b) => b.label), ...exportPresets.saved.value.filter((e) => e.id !== preset.customId).map((e) => e.name)]
}
// If the new name is taken by another preset, "(2)" is added — say so first.
function renameClash(preset: ExportPreset) {
  const wanted = renameText.value.trim()
  if (!wanted) return ''
  const unique = uniqueName(wanted, otherPresetNames(preset))
  return unique === wanted ? '' : unique
}
function onRenamePreset(preset: ExportPreset) {
  const name = renameText.value.trim()
  if (!preset.customId || !name) return
  const finalName = uniqueName(name, otherPresetNames(preset))
  if (finalName !== preset.label) exportPresets.rename(preset.customId, finalName)
  toast.add({ title: `Renamed to “${finalName}”`, color: 'success' })
  renamingId.value = null
}
function removePreset(preset: ExportPreset) {
  if (!preset.customId) return
  exportPresets.remove(preset.customId)
  const { label, aspect, w, h } = preset
  toast.add({
    title: `Deleted preset “${label}”`,
    color: 'info',
    actions: [{ label: 'Undo', onClick: () => exportPresets.save(label, { aspect, w, h }) }]
  })
}

// The crop is normally drawn on the video; the four numbers are for exact values.
const cropFieldsOpen = ref(false)

// Turn and flip (applied after the crop, before the resize).
const orient = ref<Orientation>({ ...NO_ORIENTATION })
const orientActive = computed(() => hasOrientation(orient.value))
// The sample "F" shows the result: turn clockwise, then flip (CSS lists the last step first).
// The preview does the same to the whole player; after a quarter turn it is shrunk to stay inside the 16:9 box.
const previewOriented = computed(() => orientActive.value && !cropActive.value)
const previewOrientStyle = computed(() => {
  if (!previewOriented.value) return undefined
  const o = orient.value
  const fit = swapsSides(o) ? 9 / 16 : 1
  return { transform: `scale(${fit}) scaleX(${o.flipH ? -1 : 1}) scaleY(${o.flipV ? -1 : 1}) rotate(${o.rotate}deg)`, transformOrigin: 'center' }
})
const orientSampleTransform = computed(() => `scaleX(${orient.value.flipH ? -1 : 1}) scaleY(${orient.value.flipV ? -1 : 1}) rotate(${orient.value.rotate}deg)`)

function resetTrim() {
  orient.value = { ...NO_ORIENTATION }
  range.value = [0, durationMs.value]
  cropOn.value = false
  onCropToggle(false)
  scaleOn.value = false
}

// ── Trim range: typed times and nudges ───────────────────────────────────────
const TRIM_EDGES = [
  { key: 'start' as const, label: 'Start' },
  { key: 'end' as const, label: 'End' }
]
function setEdge(edge: 'start' | 'end', ms: number) {
  range.value = withTrimEdge(range.value, edge, ms, durationMs.value)
}
function nudgeEdge(edge: 'start' | 'end', deltaMs: number) {
  setEdge(edge, range.value[edge === 'start' ? 0 : 1] + deltaMs)
}
function typeEdge(edge: 'start' | 'end', event: Event) {
  const input = event.target as HTMLInputElement
  const ms = parseTimecode(input.value)
  if (ms === null) {
    toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
  } else {
    setEdge(edge, ms)
  }
  // Show the accepted (clamped) value, or put the old one back.
  input.value = formatTimecode(range.value[edge === 'start' ? 0 : 1])
}

// "Auto-center": a crop box centred on wherever the video moves the most,
// instead of eyeballing it — a scoped stand-in for continuous face/subject
// tracking, which this server's ffmpeg build can't do reliably.
const autoCentering = ref(false)
async function onAutoCenter() {
  if (!cropAspect.value) return
  autoCentering.value = true
  try {
    const r = await autoCrop(props.video.id, cropAspect.value)
    Object.assign(crop, r)
  } catch (err) {
    toast.add({ title: 'Could not suggest a crop', description: apiErrorMessage(err), color: 'error' })
  } finally {
    autoCentering.value = false
  }
}

// While cropping, the crop layer covers the player's own controls — moving a
// trim handle shows that frame instead, so the crop can be checked anywhere.
watch(
  () => range.value[0],
  (ms) => cropOn.value && preview.value?.seek(ms, false)
)
watch(
  () => range.value[1],
  (ms) => cropOn.value && preview.value?.seek(ms, false)
)
const scaleOn = ref(false)
const scale = reactive({ w: 0, h: 0 })
function onScaleToggle(on: boolean) {
  if (on && !scale.w) Object.assign(scale, { w: naturalWidth.value || 1280, h: naturalHeight.value || 720 })
}

const trimError = computed(() => {
  const err = validateTrim(Math.round(range.value[0]), Math.round(range.value[1]), Math.round(durationMs.value) || null)
  if (err) return err
  if (cropOn.value) {
    if (!crop.w || !crop.h) return 'Drag on the video to choose the area to keep'
    const e = validateCrop(crop.x, crop.y, crop.w, crop.h, naturalWidth.value || null, naturalHeight.value || null)
    if (e) return e
  }
  if (scaleOn.value) return validateScale(scale.w, scale.h)
  return null
})

const starting = ref(false)
async function onStartTrim() {
  if (trimError.value) return
  starting.value = true
  try {
    const job = await startTrim(props.video.id, {
      startMs: Math.round(range.value[0]),
      endMs: Math.round(range.value[1]),
      crop: cropOn.value ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h } : null,
      scale: scaleOn.value ? { w: scale.w, h: scale.h } : null,
      ...orientationRequest(orient.value)
    })
    toast.add({ title: `Trim queued — job #${job.id}`, color: 'success' })
    await load()
    scrollToResults()
  } catch (err) {
    toast.add({ title: 'Could not start the trim', description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = false
  }
}

// ── Split into segments ──────────────────────────────────────────────────────
interface SegmentInput {
  startMsSeconds: number
  endMsSeconds: number | null
}
const segments = ref<SegmentInput[]>([{ startMsSeconds: 0, endMsSeconds: null }])

// A quick-glance strip above the raw-seconds inputs — numbers alone make it
// easy to miss a gap or an overlap between segments.
const SEGMENT_COLORS = ['bg-primary-500', 'bg-info-500', 'bg-success-500', 'bg-warning-500', 'bg-violet-500', 'bg-rose-500']
const segmentBars = computed(() => {
  if (!durationMs.value) return []
  return segments.value.map((s, i) => {
    const startMs = Math.max(0, s.startMsSeconds * 1000)
    const endMs = s.endMsSeconds != null ? s.endMsSeconds * 1000 : durationMs.value
    const leftPct = Math.min(100, (startMs / durationMs.value) * 100)
    const widthPct = Math.max(0, Math.min(100 - leftPct, ((endMs - startMs) / durationMs.value) * 100))
    return { leftPct, widthPct, valid: endMs > startMs, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }
  })
})

function resetSplit() {
  segments.value = [{ startMsSeconds: 0, endMsSeconds: null }]
  selectedSegment.value = null
}

const selectedSegment = ref<number | null>(null)
function selectSegment(i: number) {
  selectedSegment.value = i
  const seg = segments.value[i]
  if (seg) preview.value?.seek(seg.startMsSeconds * 1000, false)
}
function removeSegment(i: number) {
  segments.value.splice(i, 1)
  selectedSegment.value = null
}

// What is wrong with one row, shown under it as it is typed (the bottom message names the first problem only).
function rowProblem(seg: SegmentInput): string | null {
  return validateTrim(
    Math.round(seg.startMsSeconds * 1000),
    seg.endMsSeconds == null ? null : Math.round(seg.endMsSeconds * 1000),
    Math.round(durationMs.value) || null
  )
}
function segmentEndSeconds(seg: SegmentInput) {
  return seg.endMsSeconds ?? durationMs.value / 1000
}
function segmentLength(seg: SegmentInput) {
  return formatMsShort(Math.max(0, (segmentEndSeconds(seg) - seg.startMsSeconds) * 1000))
}

// Typed times ("1:23", "1:23.5"); an empty end means "to the end of the video".
function typeSegment(i: number, edge: 'start' | 'end', event: Event) {
  const seg = segments.value[i]
  const input = event.target as HTMLInputElement
  if (!seg) return
  if (edge === 'end' && input.value.trim() === '') {
    seg.endMsSeconds = null
  } else {
    const ms = parseTimecode(input.value)
    if (ms === null) toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
    else if (edge === 'start') seg.startMsSeconds = ms / 1000
    else seg.endMsSeconds = ms / 1000
  }
  // Show what was accepted, or put the old value back.
  input.value = edge === 'start' ? formatTimecode(seg.startMsSeconds * 1000) : seg.endMsSeconds == null ? '' : formatTimecode(seg.endMsSeconds * 1000)
}

// The segment the playhead is inside, if it can be cut in two there.
const splitTarget = computed(() => findSplitTarget(segments.value, currentMs.value / 1000, durationMs.value / 1000))
const canSplitHere = computed(() => !!durationMs.value && splitTarget.value !== null)
function splitAtPlayhead() {
  const i = splitTarget.value
  if (i === null) return
  segments.value = splitRowAt(segments.value, i, currentMs.value / 1000)
  selectedSegment.value = i + 1
}

// Video not covered by any segment (gaps between them, or before the first).
const uncoveredMs = computed(() => uncoveredTime(segments.value, durationMs.value))
const splitSummary = computed(() => {
  const n = segments.value.length
  return `${n} segment${n === 1 ? '' : 's'} → ${n} new video${n === 1 ? '' : 's'}${uncoveredMs.value > 0 && !splitError.value ? ` · ${formatMsShort(uncoveredMs.value)} left out` : ''}`
})

const segmentStrip = useTemplateRef<HTMLDivElement>('segmentStrip')
function dragBoundary(i: number, e: PointerEvent) {
  const strip = segmentStrip.value
  if (!strip || !durationMs.value) return
  const rect = strip.getBoundingClientRect()
  const move = (ev: PointerEvent) => {
    const seconds = (((ev.clientX - rect.left) / rect.width) * durationMs.value) / 1000
    segments.value = moveBoundary(segments.value, i, seconds, durationMs.value)
  }
  const done = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', done)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', done, { once: true })
  move(e)
}
function nudgeBoundary(i: number, dir: 1 | -1, big: boolean) {
  const at = boundaryAfter(segments.value, i)
  if (at !== null) segments.value = moveBoundary(segments.value, i, at + dir * (big ? 1 : 0.1), durationMs.value)
}

// "Every N seconds"
const everySeconds = ref<number | null>(null)
const everyRows = computed(() => (everySeconds.value ? splitEveryRows(durationMs.value, everySeconds.value) : []))
function splitEvery() {
  if (everyRows.value.length) segments.value = everyRows.value
}

// What the even-split buttons would make, e.g. "4 parts × 2:30".
const evenPreview = computed(() => {
  const n = customPartsValid.value ? customParts.value : null
  return n && durationMs.value ? `${n} parts × about ${formatMsShort(durationMs.value / n)} each` : ''
})
// A rough size per new video: the file's size in proportion to the segment's length.
const splitSizeHint = computed(() => {
  const size = props.video.fileSize
  if (!size || !durationMs.value || segments.value.length < 2 || splitError.value) return ''
  const biggest = Math.max(...segments.value.map((s) => (segmentEndSeconds(s) - s.startMsSeconds) * 1000))
  return `About ${formatFileSize(size * (biggest / durationMs.value))} for the largest new video (estimate)`
})

const customParts = ref<number | null>(null)
const evenPartsMax = computed(() => maxEvenParts(durationMs.value))
const tooManyPartsHint = computed(() => `At most ${evenPartsMax.value} parts for this video (each at least ${MIN_TRIM_MS / 1000}s, up to ${MAX_SEGMENTS})`)
const customPartsValid = computed(() => Number.isInteger(customParts.value) && customParts.value! >= 2 && customParts.value! <= evenPartsMax.value)
function splitEvenly(n: number | null) {
  const rows = n ? splitEvenlyRows(durationMs.value, n) : []
  if (rows.length) segments.value = rows
}
const splitError = computed(() =>
  validateSegments(
    segments.value.map((s) => ({ startMs: Math.round(s.startMsSeconds * 1000), endMs: s.endMsSeconds == null ? null : Math.round(s.endMsSeconds * 1000) })),
    Math.round(durationMs.value) || null
  )
)
async function onStartSplit() {
  if (splitError.value) return
  starting.value = true
  try {
    const job = await startSplit(
      props.video.id,
      segments.value.map((s) => ({ startMs: Math.round(s.startMsSeconds * 1000), endMs: s.endMsSeconds == null ? null : Math.round(s.endMsSeconds * 1000) }))
    )
    toast.add({ title: `Split queued — job #${job.id}`, color: 'success' })
    await load()
    scrollToResults()
  } catch (err) {
    toast.add({ title: 'Could not start the split', description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = false
  }
}

// ── Jobs (poll while any are active) ─────────────────────────────────────────
const visibleJobs = computed<ProcessingJob[]>(() => {
  const jobs = data.value?.jobs ?? []
  const active = jobs.filter((j) => isActiveJobStatus(j.status))
  const latest = jobs[0]
  return latest && latest.status === 'FAILED' ? [...active, latest] : active
})
// Stopping a running edit needs the jobs module's APPROVE permission (see useProcessingJobs).
const { can } = useAuth()
const jobsApi = useProcessingJobs()
const canCancel = computed(() => can('processing-jobs', 'APPROVE'))
const cancellingId = ref<number | null>(null)
async function onCancelJob(job: ProcessingJob) {
  cancellingId.value = job.id
  try {
    await jobsApi.cancel(job.id)
    toast.add({ title: `${jobLabel(job)} cancelled`, color: 'info' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not cancel the job', description: apiErrorMessage(err), color: 'error' })
  } finally {
    cancellingId.value = null
  }
}
const busy = computed(() => visibleJobs.value.some((j) => isActiveJobStatus(j.status)))
const JOB_LABELS: Record<string, string> = {
  TRIM: 'Trim',
  SPLIT: 'Split',
  AUDIO: 'Video with new audio',
  EXTRACT: 'Audio extract',
  OVERLAY: 'Text & overlay',
  AUDIO_TO_VIDEO: 'Audio to video'
}
function jobLabel(job: ProcessingJob) {
  let operation = 'Edit'
  try {
    operation = JOB_LABELS[JSON.parse(job.parameters ?? '{}').operation] ?? 'Edit'
  } catch {
    // Default label above.
  }
  if (job.status === 'FAILED') return `${operation} failed`
  return job.status === 'QUEUED' ? `${operation} — waiting` : `${operation} in progress`
}

let pollTimer: ReturnType<typeof setInterval> | undefined
watch(busy, (isBusy) => {
  clearInterval(pollTimer)
  if (isBusy) pollTimer = setInterval(load, 3000)
})
onBeforeUnmount(() => clearInterval(pollTimer))

// Fresh state on load, and again whenever the video's file changes
// (e.g. after "Replace original") — the old ranges/crop don't apply to it.
function reset() {
  mode.value = 'trim'
  cropOn.value = false
  resetZoom()
  cropAspect.value = null
  Object.assign(crop, { x: 0, y: 0, w: 0, h: 0 })
  scaleOn.value = false
  segments.value = [{ startMsSeconds: 0, endMsSeconds: null }]
  durationMs.value = (props.video.durationSeconds ?? 0) * 1000
  naturalWidth.value = props.video.width ?? 0
  naturalHeight.value = props.video.height ?? 0
  range.value = [0, durationMs.value]
  audioEdit.reset()
  overlayEdit.reset()
  draftOffered = false
  settle()
  load()
}
onMounted(reset)
watch(() => props.video.videoUrl, reset)

// The last tab used on this video comes back next time (a convenience only).
const tabKey = () => `videolingo:editor-tab:${props.video.id}`
const MODES = ['trim', 'split', 'audio', 'overlay', 'join']
onMounted(() => {
  try {
    const saved = localStorage.getItem(tabKey())
    if (saved && MODES.includes(saved)) mode.value = saved as typeof mode.value
  } catch {
    // Storage can be blocked; starting on Trim is fine.
  }
})
watch(mode, (m) => {
  try {
    localStorage.setItem(tabKey(), m)
  } catch {
    // See above.
  }
})

// ── Audio ────────────────────────────────────────────────────────────────────
const audioEdit = useAudioEdit(durationMs)

// While on the Audio tab the preview plays the level and the muted ranges
// (the rest needs rendering). The <video> can't go above 100%.
watchEffect(() => {
  const el = preview.value?.videoEl
  if (!el) return
  if (mode.value !== 'audio') {
    el.volume = 1
    el.muted = false
    return
  }
  const s = audioEdit.state
  el.volume = Math.min(1, s.volume)
  el.muted = s.volume === 0 || isMutedAt(s.mutes, currentMs.value)
})

// ── Undo / redo, and the draft kept in this browser ─────────────────────────
// Everything the tabs edit (not which tab or item is selected). audioEdit
// must exist before this: useEditorHistory reads the current state right
// away to seed history, and takeState() below touches audioEdit.state.
const overlayEdit = useOverlayEdit(durationMs)
const joinEdit = useJoinEdit(() => props.video)
watch(() => props.video.id, joinEdit.reset)
watch(() => [props.video.title, props.video.durationSeconds, props.video.videoUrl], joinEdit.refreshOwn)

// A dot on a tab means it has pending settings — easy to miss otherwise,
// since switching tabs doesn't reset or hide what's already set there.
const trimDirty = computed(() => cropOn.value || scaleOn.value || orientActive.value || range.value[0] !== 0 || range.value[1] !== durationMs.value)
const splitDirty = computed(() => segments.value.length > 1 || segments.value[0]?.startMsSeconds !== 0 || segments.value[0]?.endMsSeconds != null)
const DIRTY_BADGE = { color: 'warning' as const, size: 'xs' as const }

// A rough file size for the result: the original's, in proportion to the part kept (and the resize, if any).
// The server re-encodes, so the real size can differ — it is only a guide.
const trimSizeHint = computed(() => {
  const size = props.video.fileSize
  if (!size || !durationMs.value) return ''
  const kept = Math.max(0, range.value[1] - range.value[0]) / durationMs.value
  const pixels =
    scaleOn.value && scale.w && scale.h && naturalWidth.value && naturalHeight.value ? (scale.w * scale.h) / (naturalWidth.value * naturalHeight.value) : 1
  const area =
    cropOn.value && crop.w && crop.h && naturalWidth.value && naturalHeight.value && !scaleOn.value
      ? (crop.w * crop.h) / (naturalWidth.value * naturalHeight.value)
      : 1
  return `About ${formatFileSize(size * kept * pixels * area)} (estimate)`
})

// What "Start trim" will make, in one line.
const trimSummary = computed(() => {
  const parts = [`Trim ${formatMsShort(range.value[0])}–${formatMsShort(range.value[1])} (${formatMsShort(range.value[1] - range.value[0])})`]
  if (activePreset.value) parts.push(activePreset.value.label)
  else {
    if (cropOn.value && crop.w && crop.h) parts.push(`crop ${crop.w}×${crop.h}`)
    if (scaleOn.value && scale.w && scale.h) parts.push(`resize ${scale.w}×${scale.h}`)
  }
  if (orientActive.value) parts.push(describeOrientation(orient.value))
  return parts.join(' · ')
})
// Each tab has its own colour: its icon is tinted (stronger when selected) and the
// underline under the selected tab matches, so it's clear which tool is open.
const TAB_TONES: Record<typeof mode.value, { indicator: string; ui: { trigger: string; leadingIcon: string; label: string } }> = {
  trim: {
    indicator: 'bg-sky-600 dark:bg-sky-400',
    ui: {
      trigger: 'data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-400',
      leadingIcon: 'text-sky-600/70 group-data-[state=active]:text-sky-600 dark:text-sky-400/70 dark:group-data-[state=active]:text-sky-400',
      label: ''
    }
  },
  split: {
    indicator: 'bg-violet-600 dark:bg-violet-400',
    ui: {
      trigger: 'data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400',
      leadingIcon: 'text-violet-600/70 group-data-[state=active]:text-violet-600 dark:text-violet-400/70 dark:group-data-[state=active]:text-violet-400',
      label: ''
    }
  },
  audio: {
    indicator: 'bg-emerald-600 dark:bg-emerald-400',
    ui: {
      trigger: 'data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400',
      leadingIcon: 'text-emerald-600/70 group-data-[state=active]:text-emerald-600 dark:text-emerald-400/70 dark:group-data-[state=active]:text-emerald-400',
      label: ''
    }
  },
  overlay: {
    indicator: 'bg-rose-600 dark:bg-rose-400',
    ui: {
      trigger: 'data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-400',
      leadingIcon: 'text-rose-600/70 group-data-[state=active]:text-rose-600 dark:text-rose-400/70 dark:group-data-[state=active]:text-rose-400',
      label: ''
    }
  },
  join: {
    indicator: 'bg-orange-600 dark:bg-orange-400',
    ui: {
      trigger: 'data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400',
      leadingIcon: 'text-orange-600/70 group-data-[state=active]:text-orange-600 dark:text-orange-400/70 dark:group-data-[state=active]:text-orange-400',
      label: ''
    }
  }
}
// A tab whose edit is being made shows its progress on the tab, so it can be left
// and checked on from anywhere (the Results card below has the detail).
const JOB_TAB: Record<string, typeof mode.value> = { TRIM: 'trim', SPLIT: 'split', AUDIO: 'audio', OVERLAY: 'overlay' }
function jobOperation(job: ProcessingJob): string {
  try {
    return JSON.parse(job.parameters ?? '{}').operation ?? ''
  } catch {
    return ''
  }
}
const runningByTab = computed(() => {
  const out: Partial<Record<typeof mode.value, { label: string }>> = {}
  for (const job of visibleJobs.value) {
    if (!isActiveJobStatus(job.status)) continue
    let op = ''
    try {
      op = JSON.parse(job.parameters ?? '{}').operation ?? ''
    } catch {
      // No tab to show it on.
    }
    const tab = JOB_TAB[op]
    if (tab && !out[tab]) out[tab] = { label: job.status === 'QUEUED' ? 'queued' : `${Math.round(job.progress)}%` }
  }
  return out
})
const runningCount = computed(() => visibleJobs.value.filter((j) => isActiveJobStatus(j.status)).length)
function tabBadge(tab: typeof mode.value, dirty: boolean) {
  const running = runningByTab.value[tab]
  if (running)
    return {
      label: running.label,
      color: 'info' as const,
      size: 'xs' as const,
      icon: 'i-lucide-loader',
      ui: { leadingIcon: 'animate-spin motion-reduce:animate-none' }
    }
  return dirty ? DIRTY_BADGE : undefined
}
const tabItems = computed(() => [
  { label: 'Trim', value: 'trim', slot: 'trim' as const, icon: 'i-lucide-scissors', ui: TAB_TONES.trim.ui, badge: tabBadge('trim', trimDirty.value) },
  { label: 'Split', value: 'split', slot: 'split' as const, icon: 'i-lucide-split', ui: TAB_TONES.split.ui, badge: tabBadge('split', splitDirty.value) },
  {
    label: 'Audio',
    value: 'audio',
    slot: 'audio' as const,
    icon: 'i-lucide-audio-lines',
    ui: TAB_TONES.audio.ui,
    badge: tabBadge('audio', audioEdit.changed.value)
  },
  {
    label: 'Text',
    value: 'overlay',
    slot: 'overlay' as const,
    icon: 'i-lucide-type',
    ui: TAB_TONES.overlay.ui,
    badge: tabBadge('overlay', overlayEdit.state.layers.length > 0)
  },
  { label: 'Join', value: 'join', slot: 'join' as const, icon: 'i-lucide-film', ui: TAB_TONES.join.ui }
])

function takeState() {
  const { selectedId: _a, ...audio } = audioEdit.state
  return {
    trim: {
      range: range.value,
      cropOn: cropOn.value,
      crop: { ...crop },
      cropAspect: cropAspect.value,
      scaleOn: scaleOn.value,
      scale: { ...scale },
      orient: { ...orient.value }
    },
    split: segments.value,
    audio,
    overlay: overlayEdit.state.layers,
    join: { clips: joinEdit.state.clips }
  }
}
async function applyState(st: ReturnType<typeof takeState>) {
  range.value = st.trim.range
  cropOn.value = st.trim.cropOn
  Object.assign(crop, st.trim.crop)
  cropAspect.value = st.trim.cropAspect
  scaleOn.value = st.trim.scaleOn
  // Drafts saved before turning existed have no `orient`.
  orient.value = st.trim.orient ? { ...st.trim.orient } : { ...NO_ORIENTATION }
  Object.assign(scale, st.trim.scale)
  segments.value = st.split
  const { clips, ...audio } = st.audio
  Object.assign(audioEdit.state, audio)
  audioEdit.state.clips = clips
  overlayEdit.state.layers = st.overlay
  // Drafts saved before the Join tab existed have no `join`.
  if (st.join) Object.assign(joinEdit.state, st.join)
  if (!st.overlay.some((l) => l.id === overlayEdit.state.selectedId)) overlayEdit.state.selectedId = null
  // A changed audio source starts its clips over (useAudioEdit); put them back after that.
  await nextTick()
  audioEdit.state.clips = clips
}
// "Draft saved 14:32" next to Undo/Redo, so it is clear unrendered edits survive a reload.
const draftSavedLabel = computed(() =>
  history.draftSavedAt.value ? new Date(history.draftSavedAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)
const history = useEditorHistory({
  take: takeState,
  apply: applyState,
  draftKey: () => `videolingo:editor-draft:${props.video.id}`,
  videoUrl: () => props.video.videoUrl ?? null
})

// Once the state is loaded (and again when the real duration arrives, which
// fills in ranges and clips), that's the starting point: no undo past it,
// and a saved draft is offered once.
const draft = ref<EditorDraft | null>(null)
let draftOffered = false
function settle() {
  nextTick(() => {
    history.start()
    if (!draftOffered) {
      draftOffered = true
      draft.value = history.pendingDraft()
    }
  })
}
async function onRestoreDraft() {
  if (!draft.value) return
  await history.restoreDraft(draft.value)
  draft.value = null
}
const confirmDiscardDraft = ref(false)
function onDiscardDraft() {
  history.discardDraft()
  draft.value = null
  confirmDiscardDraft.value = false
}

// ── Promote / discard ────────────────────────────────────────────────────────
const CLIP_ICONS: Record<VideoClip['operation'], string> = {
  TRIM: 'i-lucide-scissors',
  SPLIT: 'i-lucide-split',
  AUDIO: 'i-lucide-audio-lines',
  EXTRACT: 'i-lucide-file-audio',
  OVERLAY: 'i-lucide-layers'
}
function replaces(clip: VideoClip) {
  return clip.operation === 'TRIM' || clip.operation === 'AUDIO' || clip.operation === 'OVERLAY'
}
function clipTitle(clip: VideoClip) {
  switch (clip.operation) {
    case 'SPLIT':
      return `Segment ${(clip.segmentIndex ?? 0) + 1} · ${formatMsShort(clip.startMs)}${clip.endMs != null ? ` – ${formatMsShort(clip.endMs)}` : ' – end'}`
    case 'AUDIO':
      return 'Video with new audio'
    case 'EXTRACT':
      return 'Extracted audio'
    case 'OVERLAY':
      return 'Text & overlay'
    default:
      return `Trim · ${formatMsShort(clip.startMs)}${clip.endMs != null ? ` – ${formatMsShort(clip.endMs)}` : ' – end'}`
  }
}
const confirmPromote = ref<VideoClip | null>(null)
const promoting = ref(false)
async function onPromote() {
  if (!confirmPromote.value) return
  promoting.value = true
  try {
    const result = await promote(props.video.id, confirmPromote.value.id)
    if (result.kind === 'REPLACED') {
      toast.add({ title: 'Video replaced', description: "The edited clip is now the video's file.", color: 'success' })
      emit('replaced')
    } else {
      toast.add({ title: 'New video created', description: "It's disabled until you review and enable it.", color: 'success' })
      if (result.newVideoId) emit('created', result.newVideoId)
    }
    confirmPromote.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not apply the clip', description: apiErrorMessage(err), color: 'error' })
  } finally {
    promoting.value = false
  }
}

// ── Keep a result as a separate video ────────────────────────────────────────
const asNewClip = ref<VideoClip | null>(null)
const asNewTitle = ref('')
const creatingNew = ref(false)
function openAsNew(clip: VideoClip) {
  asNewTitle.value = suggestedNewTitle(props.video.title, clip.operation, clip.segmentIndex)
  asNewClip.value = clip
}
async function onCreateNew() {
  const clip = asNewClip.value
  if (!clip || !asNewTitle.value.trim()) return
  creatingNew.value = true
  try {
    const result = await promote(props.video.id, clip.id, { asNew: true, title: asNewTitle.value })
    asNewClip.value = null
    toast.add({ title: 'New video created', description: "It's disabled until you review and enable it.", color: 'success' })
    if (result.newVideoId) emit('created', result.newVideoId)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not create the video', description: apiErrorMessage(err), color: 'error' })
  } finally {
    creatingNew.value = false
  }
}

// ── Several results at once ──────────────────────────────────────────────────
// Handy after a split or a multi-format export: tick results, then add them all
// as new videos or discard them. Extracted audio has no video to add, so it isn't tickable.
const pickedClipIds = ref<number[]>([])
const bulkBusy = ref(false)
const confirmBulkDiscard = ref(false)
const selectableClips = computed(() => (data.value?.clips ?? []).filter((c) => c.operation !== 'EXTRACT'))
const pickedClips = computed(() => selectableClips.value.filter((c) => pickedClipIds.value.includes(c.id)))
const allClipsPicked = computed(() => selectableClips.value.length > 0 && pickedClips.value.length === selectableClips.value.length)
function pickClip(id: number, on: boolean) {
  pickedClipIds.value = on ? [...new Set([...pickedClipIds.value, id])] : pickedClipIds.value.filter((x) => x !== id)
}
function pickAllClips(v: boolean | 'indeterminate') {
  pickedClipIds.value = v === true ? selectableClips.value.map((c) => c.id) : []
}
async function onBulkAddAsNew() {
  const list = [...pickedClips.value]
  bulkBusy.value = true
  let done = 0
  let lastId: number | null = null
  try {
    for (const clip of list) {
      const result = await promote(props.video.id, clip.id, { asNew: true, title: suggestedNewTitle(props.video.title, clip.operation, clip.segmentIndex) })
      if (result.newVideoId) lastId = result.newVideoId
      done++
    }
    toast.add({
      title: `${done} new video${done === 1 ? '' : 's'} created`,
      description: "They're disabled until you review and enable them.",
      color: 'success'
    })
  } catch (err) {
    toast.add({ title: done ? `${done} created, then it stopped` : 'Could not create the videos', description: apiErrorMessage(err), color: 'error' })
  } finally {
    bulkBusy.value = false
    pickedClipIds.value = []
    await load()
    if (lastId && done === 1) emit('created', lastId)
  }
}
async function onBulkDiscard() {
  const list = [...pickedClips.value]
  confirmBulkDiscard.value = false
  bulkBusy.value = true
  let done = 0
  try {
    for (const clip of list) {
      await remove(props.video.id, clip.id)
      done++
    }
    toast.add({ title: `${done} result${done === 1 ? '' : 's'} discarded`, color: 'info' })
  } catch (err) {
    toast.add({ title: done ? `${done} discarded, then it stopped` : 'Could not discard the results', description: apiErrorMessage(err), color: 'error' })
  } finally {
    bulkBusy.value = false
    pickedClipIds.value = []
    await load()
  }
}

const compareClip = ref<VideoClip | null>(null)
const previewClip = ref<VideoClip | null>(null)
// Same two paths as the buttons on the row: a result that would replace the original is added as a new video with a title to check; a split segment is confirmed.
function onPreviewAddNew() {
  const clip = previewClip.value
  if (!clip) return
  if (replaces(clip)) openAsNew(clip)
  else confirmPromote.value = clip
}

// ── First-run tip (a convenience only; storage can be blocked) ────────────────
const TIP_KEY = 'videolingo:editor-tip-dismissed'
const showTip = ref(false)
onMounted(() => {
  try {
    showTip.value = !localStorage.getItem(TIP_KEY)
  } catch {
    showTip.value = false
  }
})
function dismissTip() {
  showTip.value = false
  try {
    localStorage.setItem(TIP_KEY, '1')
  } catch {
    // It will show again next time; harmless.
  }
}

// ── Recipes: reuse a look on another video ───────────────────────────────────
const recipes = useEditRecipes()
const recipesOpen = ref(false)
const recipeName = ref('')
const currentRecipe = computed<EditRecipe | null>(() => {
  const a = audioEdit.state
  const recipe: EditRecipe = {
    frame: presetFromSettings(cropOn.value, cropAspect.value, scaleOn.value, scale),
    ...(orientActive.value ? { orient: { ...orient.value } } : {}),
    audio: audioDifferences({
      volume: a.volume,
      fadeInMs: a.fadeInMs,
      fadeOutMs: a.fadeOutMs,
      normalize: a.normalize,
      denoise: a.denoise,
      enhanceVoice: a.enhanceVoice,
      speed: a.speed,
      pitchSemitones: a.pitchSemitones,
      balance: a.balance,
      channels: a.channels
    }),
    layers: JSON.parse(JSON.stringify(overlayEdit.state.layers)) as RecipeLayer[]
  }
  return isRecipeEmpty(recipe) ? null : recipe
})
function onSaveRecipe() {
  const data = currentRecipe.value
  const name = recipeName.value.trim()
  if (!data || !name) return
  recipes.save(name, data)
  toast.add({ title: `Saved recipe “${name}”`, color: 'success' })
  recipeName.value = ''
}
function applyRecipe(r: EditRecipe, name: string) {
  if (r.frame) {
    cropOn.value = true
    setAspect(r.frame.aspect)
    scaleOn.value = true
    Object.assign(scale, { w: r.frame.w, h: r.frame.h })
  }
  if (r.orient) orient.value = { ...r.orient }
  // A recipe stands for the whole sound setup, so settings it leaves out go back to normal.
  Object.assign(audioEdit.state, fullAudio(r))
  if (r.layers.length) {
    overlayEdit.state.layers = []
    overlayEdit.addTemplate(JSON.parse(JSON.stringify(r.layers)))
  }
  recipesOpen.value = false
  toast.add({ title: `Applied “${name}”`, description: 'Undo (Ctrl/⌘+Z) brings the old settings back.', color: 'info' })
}

const confirmDiscardClip = ref<VideoClip | null>(null)
async function onConfirmDiscardClip() {
  const clip = confirmDiscardClip.value
  confirmDiscardClip.value = null
  if (clip) await onDiscard(clip)
}
async function onDiscard(clip: VideoClip) {
  try {
    await remove(props.video.id, clip.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not discard the clip', description: apiErrorMessage(err), color: 'error' })
  }
}

function formatMsShort(ms: number) {
  return formatDuration(Math.round(ms / 1000))
}
</script>
