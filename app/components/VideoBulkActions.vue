<template>
  <div class="flex flex-wrap items-center gap-2">
    <template v-if="trash">
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="success" variant="soft" icon="i-lucide-rotate-ccw" @click="openAction('restore')">
        Restore
      </UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="openAction('purge')">
        Delete permanently
      </UButton>
    </template>
    <template v-else>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="primary" variant="soft" icon="i-lucide-hash" @click="openAction('tags')">Add tags</UButton>
      <UButton v-if="can('collections', 'WRITE')" size="xs" color="primary" variant="soft" icon="i-lucide-library" @click="openAction('collection')">
        Add to collection
      </UButton>
      <UButton v-if="can('transcripts', 'WRITE')" size="xs" color="primary" variant="soft" icon="i-lucide-languages" @click="openAction('translate')">
        Translate…
      </UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="neutral" variant="soft" icon="i-lucide-copy" @click="openAction('duplicate')">Duplicate</UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="primary" variant="soft" icon="i-lucide-calendar-clock" @click="openAction('schedule')">
        Schedule
      </UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="primary" variant="soft" icon="i-lucide-book-marked" @click="openAction('recipe')">
        Apply a recipe
      </UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="primary" variant="soft" icon="i-lucide-audio-waveform" @click="openAction('pauses')">
        Remove the pauses
      </UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="neutral" variant="soft" icon="i-lucide-archive" @click="openAction('archive')">Archive</UButton>
      <UButton v-if="can('videos', 'WRITE')" size="xs" color="neutral" variant="soft" icon="i-lucide-archive-restore" @click="openAction('unarchive')">
        Unarchive
      </UButton>
    </template>

    <UModal
      v-model:open="show"
      :title="title"
      :description="`${videos.length} selected video${videos.length === 1 ? '' : 's'}`"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField v-if="action === 'tags'" label="Tags" description="Videos that already have a tag keep it.">
            <USelectMenu
              v-model="tagIds"
              :items="tagOptions"
              value-key="value"
              multiple
              placeholder="Choose tags"
              :search-input="{ placeholder: 'Search tags…' }"
              :loading="optionsLoading"
              class="w-full"
            />
          </UFormField>

          <UFormField v-else-if="action === 'collection'" label="Collection" description="Videos already in it are skipped.">
            <USelectMenu
              v-model="collectionId"
              :items="collectionOptions"
              value-key="value"
              placeholder="Choose a collection"
              :search-input="{ placeholder: 'Search collections…' }"
              :loading="optionsLoading"
              class="w-full"
            />
          </UFormField>

          <template v-else-if="action === 'translate'">
            <UFormField label="Translate into" description="Suggested languages (Settings › Translation) first. Glossaries for each language are followed.">
              <USelectMenu v-model="targetLanguages" :items="languageItems" value-key="value" multiple placeholder="Choose languages" class="w-full" />
            </UFormField>
            <UAlert
              v-if="noLanguage.length"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="`${noLanguage.length} video(s) have no spoken language set and will be skipped`"
              :description="noLanguage.map((v) => v.title).join(', ')"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Queues one translation job per video and language ({{ plannedJobs }} at most). Languages a video already has a transcript in are skipped, so
              nothing hand-edited is overwritten. Each translation needs the video's spoken-language transcript — transcribe first if it's missing.
            </p>
          </template>

          <template v-else-if="action === 'schedule'">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="The first one on">
                <UInput v-model="scheduleStart" type="datetime-local" class="w-full" aria-label="First one on" />
              </UFormField>
              <UFormField label="Then">
                <USelect
                  v-model="scheduleStep"
                  :items="SCHEDULE_STEPS.map((s) => ({ label: s.label, value: s.value }))"
                  class="w-full"
                  aria-label="How far apart"
                />
              </UFormField>
            </div>
            <ul class="max-h-48 space-y-0.5 overflow-y-auto text-xs" data-testid="schedule-plan">
              <li v-for="p in schedulePlan" :key="p.video.id" class="flex justify-between gap-2">
                <span class="truncate">{{ p.video.title }}</span>
                <span class="shrink-0 tabular-nums" :class="p.at ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'">{{
                  p.at ? p.at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : p.skipped
                }}</span>
              </li>
            </ul>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              In the order shown, in your own time. Each is enabled by itself then; enabled videos are left as they are.
            </p>
          </template>

          <template v-else-if="action === 'recipe'">
            <p v-if="!recipes.saved.value.length" class="text-sm text-gray-600 dark:text-gray-300">
              No saved recipes yet. Save one in the video editor (Recipes, in its header) — a crop shape and size, sound settings and text layers.
            </p>
            <UFormField v-else label="Recipe" description="Saved in the video editor, in this browser.">
              <USelect
                v-model="recipeId"
                :items="recipes.saved.value.map((r) => ({ label: r.name, value: r.id }))"
                placeholder="Choose a recipe"
                class="w-full"
              />
            </UFormField>
            <p v-if="chosenRecipe" class="text-xs text-gray-500 dark:text-gray-400">
              {{ describeRecipe(chosenRecipe.data) }}. Queues an edit per part (picture, sound, layers) on each video; the results appear under Results in each
              video's editor, to replace the original or add as a new video.
            </p>
          </template>

          <template v-else-if="action === 'pauses'">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Finds the quiet stretches in each video's sound and cuts the long ones out, keeping a little quiet next to the speech. Queues a cut on each video;
              the results appear under Results in each video's editor, to check before they replace the original or become new videos.
            </p>
            <USelect
              v-model="pauseNoiseDb"
              :items="PAUSE_LEVELS.map((l) => ({ label: l.label, value: l.value }))"
              class="w-56"
              aria-label="How quiet a pause is"
            />
            <SliderRow v-model="pauseMinMs" label="Cut pauses longer than" :min="300" :max="3000" :step="100" :default-value="1000" unit=" ms" />
            <SliderRow v-model="pauseKeepMs" label="Keep next to the speech" :min="0" :max="500" :step="50" :default-value="200" unit=" ms" />
          </template>

          <p v-else-if="action === 'duplicate'" class="text-sm text-gray-600 dark:text-gray-300">
            Makes a full copy of each — same file, metadata, categories and tags — disabled until reviewed.
          </p>
          <p v-else-if="action === 'archive'" class="text-sm text-gray-600 dark:text-gray-300">
            Puts each aside, out of the active library. Learners can't watch them either way.
          </p>
          <p v-else-if="action === 'unarchive'" class="text-sm text-gray-600 dark:text-gray-300">Brings each back into the active library.</p>
          <p v-else-if="action === 'restore'" class="text-sm text-gray-600 dark:text-gray-300">Takes each out of the trash, back into the active library.</p>
          <p v-else-if="action === 'purge'" class="text-sm text-gray-600 dark:text-gray-300">
            Permanently deletes each and frees its storage. <span class="font-medium text-error-600 dark:text-error-400">This cannot be undone.</span>
          </p>

          <!-- Results -->
          <div
            v-if="results.length"
            class="rounded-lg border border-gray-200 dark:border-gray-800 max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 text-sm"
          >
            <div v-for="(r, i) in results" :key="i" class="flex items-start gap-2 px-3 py-1.5">
              <UIcon
                :name="r.outcome === 'ok' ? 'i-lucide-check-circle' : r.outcome === 'skipped' ? 'i-lucide-circle-minus' : 'i-lucide-x-circle'"
                class="w-4 h-4 mt-0.5 shrink-0"
                :class="r.outcome === 'ok' ? 'text-success-500' : r.outcome === 'skipped' ? 'text-gray-400' : 'text-error-500'"
              />
              <span class="min-w-0"
                ><span class="font-medium">{{ r.video }}</span> — {{ r.message }}</span
              >
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="show = false">{{ results.length ? 'Close' : 'Cancel' }}</UButton>
            <UButton v-if="!results.length" :color="action === 'purge' ? 'error' : 'primary'" :icon="icon" :loading="running" :disabled="!ready" @click="run">
              {{ title }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Bulk actions for the selected rows of the videos list: add tags, add to a
// collection, queue translations, or (for `trash`) restore or permanently
// delete. Each runs per video (the API is per-video) and reports every
// outcome, so a partial failure is visible.
import type { Video } from '~/composables/useVideos'
import type { AudioEditRequest, OverlayLayer } from '~/composables/useVideoEdits'
import { recipeJobsFor } from '#shared/utils/bulkRecipe'
import { fromDateTimeLocal, SCHEDULE_STEPS, schedulePresets, scheduleSeries, toDateTimeLocal } from '#shared/utils/publishSchedule'
import { describeRecipe } from '#shared/utils/editRecipe'
import { bulkPausePlan, PAUSE_LEVELS, pauseCutSkip } from '#shared/utils/pauseCuts'

const props = defineProps<{ videos: Video[]; trash?: boolean }>()
const emit = defineEmits<{ done: [] }>()

const { can } = useAuth()
const { list: listTags, assignToVideo } = useTags()
const { list: listCollections, addVideos } = useCollections()
const { list: listTranscripts, create: createTranscript, regenerate } = useTranscripts()
const { duplicate, archive, unarchive, restore, purge, schedulePublish } = useVideos()
const { settings: clientSettings } = useClientSettings()
const { startTrim, startAudio, startOverlay, startCut, pauses } = useVideoEdits()
const pauseNoiseDb = ref<(typeof PAUSE_LEVELS)[number]['value']>(PAUSE_LEVELS[0].value)
const pauseMinMs = ref(1000)
const pauseKeepMs = ref(200)
const recipes = useEditRecipes()
const recipeId = ref<string | undefined>()
const scheduleStart = ref(toDateTimeLocal(schedulePresets(new Date())[1]!.at))
const scheduleStep = ref<number>(SCHEDULE_STEPS[1].value)
const schedulePlan = computed(() => {
  const start = fromDateTimeLocal(scheduleStart.value)
  return start
    ? scheduleSeries(props.videos, start, scheduleStep.value, new Date())
    : props.videos.map((video) => ({ video, at: null, skipped: 'choose a time' }))
})
const chosenRecipe = computed(() => recipes.saved.value.find((r) => r.id === recipeId.value) ?? null)
const toast = useToast()

type Action = 'tags' | 'collection' | 'translate' | 'duplicate' | 'archive' | 'unarchive' | 'restore' | 'purge' | 'recipe' | 'schedule' | 'pauses'
const action = ref<Action>('tags')
const show = ref(false)
const running = ref(false)
const optionsLoading = ref(false)
const results = ref<{ video: string; outcome: 'ok' | 'skipped' | 'failed'; message: string }[]>([])

const title = computed(
  () =>
    ({
      tags: 'Add tags',
      collection: 'Add to collection',
      translate: 'Queue translations',
      duplicate: 'Duplicate videos',
      archive: 'Archive videos',
      unarchive: 'Unarchive videos',
      restore: 'Restore videos',
      purge: 'Delete permanently',
      recipe: 'Apply a recipe',
      schedule: 'Schedule videos',
      pauses: 'Remove the pauses'
    })[action.value]
)
const icon = computed(
  () =>
    ({
      tags: 'i-lucide-hash',
      collection: 'i-lucide-library',
      translate: 'i-lucide-languages',
      duplicate: 'i-lucide-copy',
      archive: 'i-lucide-archive',
      unarchive: 'i-lucide-archive-restore',
      restore: 'i-lucide-rotate-ccw',
      purge: 'i-lucide-trash-2',
      recipe: 'i-lucide-book-marked',
      schedule: 'i-lucide-calendar-clock',
      pauses: 'i-lucide-audio-waveform'
    })[action.value]
)

const tagIds = ref<number[]>([])
const tagOptions = ref<{ label: string; value: number }[]>([])
const collectionId = ref<number | undefined>()
const collectionOptions = ref<{ label: string; value: number }[]>([])
const targetLanguages = ref<string[]>([])

const suggested = computed(() => clientSettings.value?.defaultTargetLanguages ?? [])
const languageItems = computed(() =>
  languageOptions()
    .filter((o): o is { label: string; value: string } => !!o.value)
    .map((o) => ({ ...o, label: suggested.value.includes(o.value) ? `${o.label} (suggested)` : o.label }))
    .sort((a, b) => Number(suggested.value.includes(b.value)) - Number(suggested.value.includes(a.value)))
)
const noLanguage = computed(() => props.videos.filter((v) => !v.language))
const plannedJobs = computed(() => (props.videos.length - noLanguage.value.length) * targetLanguages.value.length)

const ready = computed(() =>
  action.value === 'tags'
    ? tagIds.value.length > 0
    : action.value === 'collection'
      ? !!collectionId.value
      : action.value === 'translate'
        ? plannedJobs.value > 0
        : action.value === 'recipe'
          ? !!chosenRecipe.value
          : action.value === 'schedule'
            ? schedulePlan.value.some((p) => p.at)
            : true
)

async function openAction(a: Action) {
  action.value = a
  results.value = []
  tagIds.value = []
  collectionId.value = undefined
  targetLanguages.value = [...suggested.value]
  show.value = true
  if (a !== 'tags' && a !== 'collection') return
  optionsLoading.value = true
  try {
    if (a === 'tags')
      tagOptions.value = (await listTags({ size: 500, sortBy: 'name', sortOrder: 'asc' })).data.map((t) => ({ label: `#${t.name}`, value: t.id }))
    else collectionOptions.value = (await listCollections({ size: 500 })).data.map((c) => ({ label: c.title, value: c.id }))
  } catch (err) {
    toast.add({ title: 'Could not load the options', description: apiErrorMessage(err), color: 'error' })
  } finally {
    optionsLoading.value = false
  }
}

async function run() {
  running.value = true
  results.value = []
  const push = (video: string, outcome: 'ok' | 'skipped' | 'failed', message: string) => results.value.push({ video, outcome, message })
  try {
    if (action.value === 'tags') {
      for (const v of props.videos) {
        try {
          await assignToVideo(v.id, tagIds.value)
          push(v.title, 'ok', 'tagged')
        } catch (err) {
          push(v.title, 'failed', apiErrorMessage(err))
        }
      }
    } else if (action.value === 'collection') {
      // One request for all of them.
      try {
        await addVideos(
          collectionId.value!,
          props.videos.map((v) => v.id)
        )
        push(`${props.videos.length} video(s)`, 'ok', `added to “${collectionOptions.value.find((c) => c.value === collectionId.value)?.label}”`)
      } catch (err) {
        push(`${props.videos.length} video(s)`, 'failed', apiErrorMessage(err))
      }
    } else if (action.value === 'duplicate') {
      for (const v of props.videos) {
        try {
          const copy = await duplicate(v.id)
          push(v.title, 'ok', `duplicated as “${copy.title}”`)
        } catch (err) {
          push(v.title, 'failed', apiErrorMessage(err))
        }
      }
    } else if (action.value === 'schedule') {
      for (const p of schedulePlan.value) {
        if (!p.at) {
          push(p.video.title, 'skipped', p.skipped ?? '')
          continue
        }
        try {
          await schedulePublish(p.video.id, p.at)
          push(p.video.title, 'ok', `scheduled for ${p.at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`)
        } catch (err) {
          push(p.video.title, 'failed', apiErrorMessage(err))
        }
      }
    } else if (action.value === 'recipe') {
      const recipe = chosenRecipe.value!.data
      for (const v of props.videos) {
        const plan = recipeJobsFor(recipe, v)
        const queued: string[] = []
        try {
          if (plan.trim) queued.push(`picture #${(await startTrim(v.id, plan.trim)).id}`)
          if (plan.audio) queued.push(`sound #${(await startAudio(v.id, plan.audio as AudioEditRequest)).id}`)
          if (plan.overlay) queued.push(`layers #${(await startOverlay(v.id, plan.overlay as unknown as OverlayLayer[])).id}`)
          if (queued.length) push(v.title, 'ok', `queued ${queued.join(', ')}${plan.note ? ` — ${plan.note}` : ''}`)
          else push(v.title, 'skipped', plan.note ?? 'nothing in the recipe applies')
        } catch (err) {
          push(v.title, 'failed', `${queued.length ? `queued ${queued.join(', ')}, then: ` : ''}${apiErrorMessage(err)}`)
        }
      }
    } else if (action.value === 'pauses') {
      for (const v of props.videos) {
        const skip = pauseCutSkip(v)
        if (skip) {
          push(v.title, 'skipped', skip)
          continue
        }
        try {
          const plan = bulkPausePlan(await pauses(v.id, pauseNoiseDb.value), { minPauseMs: pauseMinMs.value, keepMs: pauseKeepMs.value })
          if (plan.skip) push(v.title, 'skipped', plan.skip)
          else push(v.title, 'ok', `queued cut #${(await startCut(v.id, plan.cuts)).id}: ${plan.line}`)
        } catch (err) {
          push(v.title, 'failed', apiErrorMessage(err))
        }
      }
    } else if (action.value === 'archive' || action.value === 'unarchive') {
      for (const v of props.videos) {
        try {
          if (action.value === 'archive') await archive(v.id)
          else await unarchive(v.id)
          push(v.title, 'ok', action.value === 'archive' ? 'archived' : 'unarchived')
        } catch (err) {
          push(v.title, 'failed', apiErrorMessage(err))
        }
      }
    } else if (action.value === 'restore' || action.value === 'purge') {
      for (const v of props.videos) {
        try {
          if (action.value === 'restore') await restore(v.id)
          else await purge(v.id)
          push(v.title, 'ok', action.value === 'restore' ? 'restored' : 'permanently deleted')
        } catch (err) {
          push(v.title, 'failed', apiErrorMessage(err))
        }
      }
    } else {
      for (const v of props.videos) {
        if (!v.language) {
          push(v.title, 'skipped', 'no spoken language set')
          continue
        }
        let existing: string[] = []
        try {
          existing = (await listTranscripts({ videoId: v.id, size: 100 })).data.map((t) => t.language)
        } catch (err) {
          push(v.title, 'failed', apiErrorMessage(err))
          continue
        }
        for (const lang of targetLanguages.value) {
          const name = languageLabel(lang)
          if (lang === v.language) push(v.title, 'skipped', `${name} is its spoken language`)
          else if (existing.includes(lang)) push(v.title, 'skipped', `already has a ${name} transcript`)
          else {
            try {
              const t = await createTranscript({ videoId: v.id, language: lang, source: 'MANUAL', segments: [] })
              const job = await regenerate(t.id)
              push(v.title, 'ok', `${name} queued (job #${job.id})`)
            } catch (err) {
              push(v.title, 'failed', `${name}: ${apiErrorMessage(err)}`)
            }
          }
        }
      }
    }
    const ok = results.value.filter((r) => r.outcome === 'ok').length
    const failed = results.value.filter((r) => r.outcome === 'failed').length
    toast.add({ title: `${title.value}: ${ok} done${failed ? `, ${failed} failed` : ''}`, color: failed ? 'warning' : 'success' })
    emit('done')
  } finally {
    running.value = false
  }
}
</script>
