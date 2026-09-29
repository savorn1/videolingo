<template>
  <span
    class="inline-flex items-center justify-center rounded-full font-semibold leading-none shrink-0 select-none"
    :class="[SIZE_CLASSES[size], colorClasses]"
  >
    {{ initials }}
  </span>
</template>

<script setup lang="ts">
// Replaces Nuxt UI's flat-gray `UAvatar` wherever an avatar just shows
// initials (no uploaded photo) — a hashed colour per name reads as a real
// person rather than an empty placeholder, same idea as UserChip.
import { avatarColorClasses, avatarInitials } from '#shared/utils/avatarColor'

const props = withDefaults(defineProps<{ name: string | null | undefined; size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' }>(), {
  size: 'md'
})

const SIZE_CLASSES: Record<NonNullable<typeof props.size>, string> = {
  '2xs': 'w-5 h-5 text-[10px]',
  xs: 'w-6 h-6 text-[11px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-14 h-14 text-lg',
  '2xl': 'w-16 h-16 text-xl',
  '3xl': 'w-20 h-20 text-2xl'
}

const initials = computed(() => avatarInitials(props.name))
const colorClasses = computed(() => avatarColorClasses(props.name))
</script>
