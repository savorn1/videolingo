<template>
  <div @dragenter.prevent="onDragEnter" @dragover.prevent @dragleave="onDragLeave" @drop.prevent="onDrop">
    <PageHeader
      title="Video from audio"
      description="Turn podcasts, songs or lesson recordings into videos: the sound over a picture, a title card or a plain colour, with an optional moving waveform."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Video from audio' }]"
    />

    <!-- Whole-page drop target -->
    <div
      v-if="dragging"
      class="fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-primary-400 bg-primary-500/10 pointer-events-none"
      :class="TAB_ACCENTS.audio.scope"
      aria-hidden="true"
    >
      <p class="rounded-lg bg-white px-4 py-2 font-medium text-primary-700 shadow dark:bg-gray-900 dark:text-primary-300">
        Drop audio files or pictures to add them
      </p>
    </div>

    <form class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start" @submit.prevent="onSubmit">
      <div class="lg:col-span-3 space-y-4">
        <!-- 1. The sound -->
        <AudioVideoFilesStep />
        <!-- 2. The look -->
        <AudioVideoLookStep />
        <!-- 3. Sound -->
        <AudioVideoSoundStep />
        <!-- 4. The details -->
        <AudioVideoDetailsStep />
        <AudioVideoActionBar />
      </div>

      <!-- Preview: how the frame will look -->
      <AudioVideoPreview />
    </form>
  </div>
</template>

<script setup lang="ts">
// Makes videos from sounds. The state and actions live in useAudioToVideoForm, provided to the
// step components under app/components/audio-video.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'

definePageMeta({ middleware: 'admin' })

const { dragging, onDragEnter, onDragLeave, onDrop, onSubmit, submitted, items, slides, picUploading } = provideAudioToVideoForm()

useUnsavedChangesGuard(() => !submitted.value && (items.value.length > 0 || slides.value.length > 0 || picUploading.value))
</script>
