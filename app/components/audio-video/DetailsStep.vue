<template>
  <AudioVideoStepCard :step="4" title="Details">
    <div class="space-y-5">
      <UFormField label="Description" description="Shared by all the videos.">
        <UTextarea v-model="description" :rows="3" autoresize :maxrows="10" maxlength="10000" class="w-full" />
      </UFormField>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <UFormField label="Spoken language" :error="errors.language">
          <USelectMenu
            v-model="language"
            v-model:open="languageOpen"
            :items="languageItems"
            value-key="value"
            placeholder="Not set"
            :search-input="{ placeholder: 'Search languages…' }"
            aria-label="Spoken language"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Categories" :required="requireCategory" :error="errors.categoryIds" :hint="`Up to ${maxCategories}`">
          <USelectMenu
            v-model="categoryIds"
            :items="categoryItems"
            value-key="value"
            multiple
            placeholder="Choose categories"
            aria-label="Categories"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Add to a collection" description="Keeps a series together, in the order you add it.">
          <USelectMenu
            v-model="collectionId"
            :items="collectionItems"
            value-key="value"
            placeholder="None"
            :loading="collectionsLoading"
            aria-label="Collection"
            class="w-full"
          />
        </UFormField>
      </div>
      <USwitch v-model="transcribe" :disabled="!language" label="Transcribe when ready" description="Makes a transcript of each video once it is finished.">
        <!-- Off until there's a language: a way straight to it -->
        <template v-if="!language" #description>
          <UButton size="xs" color="primary" variant="link" class="p-0" @click="languageOpen = true">Choose the spoken language first</UButton>
        </template>
      </USwitch>
      <div v-if="transcribe" class="space-y-2 pl-11" data-testid="burn-subtitles">
        <USwitch
          v-model="burnSubtitles"
          label="Burn the subtitles into the video"
          description="Once the transcript is made, its lines are drawn onto the picture — readable anywhere, even with the sound off."
        />
        <template v-if="burnSubtitles">
          <div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Subtitle style">
            <UButton
              v-for="st in BURN_STYLES"
              :key="st.value"
              size="xs"
              role="radio"
              :aria-checked="subtitleStyle === st.value"
              :color="subtitleStyle === st.value ? 'primary' : 'neutral'"
              :variant="subtitleStyle === st.value ? 'soft' : 'ghost'"
              @click="subtitleStyle = st.value"
              >{{ st.label }}</UButton
            >
          </div>
          <div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Subtitle position">
            <UButton
              v-for="pos in ['BOTTOM', 'TOP'] as const"
              :key="pos"
              size="xs"
              role="radio"
              :aria-checked="subtitlePosition === pos"
              :color="subtitlePosition === pos ? 'primary' : 'neutral'"
              :variant="subtitlePosition === pos ? 'soft' : 'ghost'"
              @click="subtitlePosition = pos"
              >{{ pos === 'BOTTOM' ? 'Bottom' : 'Top' }}</UButton
            >
          </div>
          <p v-if="subtitleClash" class="text-xs text-warning-700 dark:text-warning-400">{{ subtitleClash }}</p>
          <UFormField label="Second line in another language" description="The subtitles are translated and shown as a smaller line under each one.">
            <USelectMenu
              v-model="secondLanguage"
              :items="secondLanguageItems"
              value-key="value"
              placeholder="None"
              :search-input="{ placeholder: 'Search languages…' }"
              aria-label="Second subtitle language"
              class="w-full sm:w-64"
            />
          </UFormField>
        </template>
      </div>

      <div class="space-y-2" data-testid="highlight">
        <USwitch
          v-model="highlight"
          label="Also make a highlight clip"
          description="A short tall video (9:16) of each recording's liveliest stretch, for Shorts, Reels or TikTok — starting and ending at pauses."
        />
        <div v-if="highlight" class="flex flex-wrap items-center gap-1 pl-11" role="radiogroup" aria-label="Highlight length">
          <UButton
            v-for="sec in HIGHLIGHT_LENGTHS"
            :key="sec"
            size="xs"
            role="radio"
            :aria-checked="highlightSeconds === sec"
            :color="highlightSeconds === sec ? 'primary' : 'neutral'"
            :variant="highlightSeconds === sec ? 'soft' : 'ghost'"
            @click="highlightSeconds = sec"
            >About {{ sec }} s</UButton
          >
        </div>
        <ul v-if="highlight" class="space-y-2 pl-11" data-testid="highlight-picks">
          <li v-for="it in readyItems" :key="it.id" class="space-y-1">
            <div class="flex items-center gap-2 text-xs">
              <span class="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{{ it.title || it.name }}</span>
              <template v-if="it.highlight">
                <span class="tabular-nums text-gray-500 dark:text-gray-400"
                  >{{ formatTimecode(it.highlight.startMs) }} – {{ formatTimecode(it.highlight.endMs) }}</span
                >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :icon="playingId === it.id ? 'i-lucide-square' : 'i-lucide-play'"
                  :aria-label="playingId === it.id ? `Stop the highlight of ${it.name}` : `Play the highlight of ${it.name}`"
                  @click="playHighlight(it)"
                />
              </template>
              <span v-else-if="it.highlightFinding" class="text-gray-500 dark:text-gray-400">Finding the liveliest part…</span>
              <UButton v-else size="xs" color="neutral" variant="link" :padded="false" @click="findHighlight(it)">Find it</UButton>
            </div>
            <USlider
              v-if="it.highlight && it.durationSeconds"
              :model-value="Math.round(it.highlight.startMs / 1000)"
              :min="0"
              :max="Math.max(0, it.durationSeconds - Math.round((it.highlight.endMs - it.highlight.startMs) / 1000))"
              :step="1"
              size="xs"
              :aria-label="`Highlight start for ${it.name}`"
              @update:model-value="(v) => moveHighlight(it, Number(v) * 1000)"
            />
          </li>
          <li class="text-xs text-gray-500 dark:text-gray-400">Picked at the loudest, busiest stretch — slide to move it, ▶ to hear it.</li>
        </ul>
      </div>

      <div class="space-y-2" data-testid="schedule-on-make">
        <USwitch
          v-model="schedule"
          label="Publish them on a schedule"
          description="Each video enables itself in turn, in the order of the files — once it is made. Highlight clips aren't scheduled."
        />
        <div v-if="schedule" class="flex flex-wrap items-end gap-3 pl-11">
          <UFormField label="First one">
            <UInput v-model="scheduleStart" type="datetime-local" size="sm" aria-label="First video publishes at" />
          </UFormField>
          <UFormField label="Then">
            <USelect
              v-model="scheduleStep"
              :items="SCHEDULE_STEPS.map((s) => ({ label: s.label, value: s.value }))"
              size="sm"
              class="w-40"
              aria-label="Time between videos"
            />
          </UFormField>
        </div>
      </div>
    </div>
  </AudioVideoStepCard>
</template>

<script setup lang="ts">
// Step 4 of "Video from audio": what the videos are filed under, transcripts and subtitles, a highlight clip, and a schedule.
import { BURN_STYLES } from '#shared/utils/audioVideo'
import { HIGHLIGHT_LENGTHS } from '#shared/utils/audioVideoExtras'
import { formatTimecode } from '#shared/utils/transport'
import { SCHEDULE_STEPS } from '#shared/utils/publishSchedule'
const {
  maxCategories,
  requireCategory,
  description,
  language,
  categoryIds,
  collectionId,
  transcribe,
  burnSubtitles,
  subtitleStyle,
  subtitlePosition,
  errors,
  languageItems,
  categoryItems,
  collectionItems,
  collectionsLoading,
  subtitleClash,
  secondLanguage,
  highlight,
  highlightSeconds,
  readyItems,
  playingId,
  findHighlight,
  moveHighlight,
  playHighlight,
  schedule,
  scheduleStart,
  scheduleStep
} = useAudioToVideoFormContext()
// The language list, opened from the transcribe switch's hint.
const languageOpen = ref(false)
// Any language but the spoken one.
const secondLanguageItems = computed(() => [{ label: 'None', value: undefined }, ...languageItems.value.filter((o) => o.value && o.value !== language.value)])
</script>
