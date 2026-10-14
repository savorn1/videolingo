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
      <USwitch
        v-model="transcribe"
        :disabled="!language"
        label="Transcribe when ready"
        :description="language ? 'Makes a transcript of each video once it is finished.' : 'Choose the spoken language first.'"
      />
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
  schedule,
  scheduleStart,
  scheduleStep
} = useAudioToVideoFormContext()
// Any language but the spoken one.
const secondLanguageItems = computed(() => [{ label: 'None', value: undefined }, ...languageItems.value.filter((o) => o.value && o.value !== language.value)])
</script>
