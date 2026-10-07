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
        </template>
      </div>
    </div>
  </AudioVideoStepCard>
</template>

<script setup lang="ts">
// Step 4 of "Video from audio": what the videos are filed under, and transcripts.
import { BURN_STYLES } from '#shared/utils/audioVideo'
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
  subtitleClash
} = useAudioToVideoFormContext()
</script>
