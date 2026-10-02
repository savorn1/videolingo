<template>
  <UCard class="mb-6" :ui="{ body: 'p-4 sm:p-5' }">
    <ClientOnly>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        <!-- Streak -->
        <div class="flex items-center gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            :class="
              streak
                ? 'bg-warning-50 text-warning-600 dark:bg-warning-950 dark:text-warning-400'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
            "
          >
            <UIcon name="i-lucide-flame" class="h-6 w-6" />
          </div>
          <div class="min-w-0">
            <p class="text-2xl font-semibold leading-none tabular-nums text-gray-900 dark:text-white">
              {{ streak }} <span class="text-sm font-normal text-gray-500 dark:text-gray-400">day{{ streak === 1 ? '' : 's' }}</span>
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ streakNote }}</p>
          </div>
        </div>

        <!-- Today's goal -->
        <div class="min-w-0 space-y-2">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Today</p>
            <p class="text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ todayMinutes }} of {{ goalMinutes }} min</p>
          </div>
          <div
            class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            role="progressbar"
            aria-label="Daily goal"
            :aria-valuenow="Math.round(goalDone * 100)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              :class="goalDone >= 1 ? 'bg-success-500' : 'bg-sky-500 dark:bg-sky-400'"
              :style="{ width: `${Math.round(goalDone * 100)}%` }"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              <template v-if="goalDone >= 1">Goal reached. Nice work.</template>
              <template v-else>{{ remainingMinutes }} min to go</template>
            </p>
            <div class="flex items-center gap-1" role="group" aria-label="Daily goal in minutes">
              <UButton
                v-for="m in GOAL_MINUTES"
                :key="m"
                size="xs"
                :color="goalMinutes === m ? 'primary' : 'neutral'"
                :variant="goalMinutes === m ? 'soft' : 'ghost'"
                :aria-pressed="goalMinutes === m"
                :aria-label="`Goal ${m} minutes`"
                @click="setGoal(m)"
              >
                {{ m }}
              </UButton>
            </div>
          </div>
        </div>

        <!-- Last 7 days -->
        <div class="min-w-0">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Last 7 days</p>
            <p v-if="best > 1" class="text-xs text-gray-500 dark:text-gray-400">Best streak {{ best }}</p>
          </div>
          <ul class="mt-2 flex h-14 items-end gap-1.5" aria-label="Study time per day">
            <li v-for="d in bars" :key="d.key" class="flex h-full flex-1 flex-col items-center justify-end gap-1" :title="d.title">
              <span class="flex w-full flex-1 items-end">
                <span
                  class="w-full rounded-sm"
                  :class="d.active ? 'bg-violet-500 dark:bg-violet-400' : d.seconds ? 'bg-violet-200 dark:bg-violet-900' : 'bg-gray-100 dark:bg-gray-800'"
                  :style="{ height: d.height }"
                />
              </span>
              <span class="text-[10px] leading-none" :class="d.isToday ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400'">{{ d.label }}</span>
            </li>
          </ul>
        </div>
      </div>
      <template #fallback>
        <USkeleton class="h-20 w-full" />
      </template>
    </ClientOnly>
  </UCard>
</template>

<script setup lang="ts">
// The learner's streak, today's progress toward a daily goal, and the last
// week at a glance. Counted from what this browser has seen (see
// useStudyActivity), so it follows this browser rather than the account.
import { GOAL_MINUTES } from '#shared/utils/studyActivity'

const { load, setGoal, goalMinutes, todaySeconds, goalDone, streak, best, week } = useStudyActivity()
onMounted(load)

const todayMinutes = computed(() => Math.floor(todaySeconds.value / 60))
const remainingMinutes = computed(() => Math.max(1, Math.ceil(goalMinutes.value - todaySeconds.value / 60)))

const streakNote = computed(() => {
  if (!streak.value) return 'Study for a minute today to start one.'
  const todayDone = week.value[week.value.length - 1]?.active
  return todayDone ? 'Keep it going tomorrow.' : 'Study today to keep it.'
})

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const bars = computed(() => {
  const goalSeconds = goalMinutes.value * 60
  return week.value.map((d, i) => {
    const [y, m, day] = d.key.split('-').map(Number)
    const date = new Date(y!, m! - 1, day!, 12)
    // Bars are scaled to the goal, so a full bar means the goal was met; a sliver shows any study at all.
    const share = Math.min(1, d.seconds / goalSeconds)
    return {
      ...d,
      label: WEEKDAYS[date.getDay()]!,
      isToday: i === week.value.length - 1,
      height: d.seconds ? `${Math.max(12, Math.round(share * 100))}%` : '4px',
      title: `${date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${Math.floor(d.seconds / 60)} min`
    }
  })
})
</script>
