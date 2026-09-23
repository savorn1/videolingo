<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-3">
      <div class="min-w-0">
        <h3 class="font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
        <p v-if="subtitle" class="text-xs text-gray-500">{{ subtitle }}</p>
      </div>
      <UButton size="xs" color="neutral" variant="ghost" :icon="asTable ? 'i-lucide-chart-column' : 'i-lucide-table'" @click="asTable = !asTable">
        {{ asTable ? 'Chart' : 'Table' }}
      </UButton>
    </div>

    <div v-if="asTable" class="max-h-64 overflow-y-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-gray-500 text-left sticky top-0 bg-(--ui-bg)">
          <tr>
            <th class="py-1 font-medium">{{ columnLabel }}</th>
            <th class="py-1 font-medium text-right">{{ valueLabel }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="item in items" :key="item.key">
            <td class="py-1 text-gray-700 dark:text-gray-300">{{ item.tooltip ?? item.label }}</td>
            <td class="py-1 text-right tabular-nums">{{ format(item.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="flex gap-2">
      <!-- Y axis (recessive) -->
      <div class="flex flex-col justify-between text-[11px] text-gray-400 tabular-nums text-right -mt-1.5 w-14 shrink-0" :style="{ height }">
        <span v-for="t in ticks" :key="t">{{ format(t) }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="relative" :style="{ height }" @mouseleave="hover = null">
          <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div
              v-for="t in ticks"
              :key="t"
              class="border-t"
              :class="t === 0 ? 'border-gray-300 dark:border-gray-600' : 'border-gray-100 dark:border-gray-800'"
            />
          </div>

          <!-- Line variant: 2px stroke over a faint area -->
          <svg
            v-if="variant === 'line'"
            class="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon :points="areaPoints" class="fill-primary-500/10 dark:fill-primary-400/10" />
            <polyline
              :points="linePoints"
              fill="none"
              class="stroke-primary-500 dark:stroke-primary-400"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
              stroke-linejoin="round"
            />
          </svg>

          <!-- Columns: bars (bar variant) and full-height hover targets (both) -->
          <div class="absolute inset-0 flex items-end" :class="variant === 'bar' ? 'gap-0.5' : ''">
            <div
              v-for="(item, i) in items"
              :key="item.key"
              class="flex-1 h-full flex items-end"
              role="img"
              :aria-label="`${item.tooltip ?? item.label}: ${format(item.value)}`"
              @mouseenter="hover = i"
            >
              <div
                v-if="variant === 'bar'"
                class="w-full rounded-t-[4px] bg-primary-500 dark:bg-primary-400 transition-opacity"
                :class="hover !== null && hover !== i ? 'opacity-50' : ''"
                :style="{ height: item.value > 0 ? `max(2px, ${(item.value / top) * 100}%)` : '0' }"
              />
            </div>
          </div>

          <!-- Line crosshair + marker -->
          <template v-if="variant === 'line' && hover !== null && items[hover]">
            <div class="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600 pointer-events-none" :style="{ left: `${xPct(hover)}%` }" />
            <div
              class="absolute w-2.5 h-2.5 -ml-[5px] -mb-[5px] rounded-full bg-primary-500 dark:bg-primary-400 ring-2 ring-white dark:ring-gray-900 pointer-events-none"
              :style="{ left: `${xPct(hover)}%`, bottom: `${(items[hover]!.value / top) * 100}%` }"
            />
          </template>

          <!-- Tooltip, inside the plot beside the hovered column -->
          <div
            v-if="hover !== null && items[hover]"
            class="absolute top-1 z-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs shadow-md pointer-events-none whitespace-nowrap"
            :style="tooltipStyle"
          >
            <p class="font-medium text-gray-900 dark:text-white">{{ items[hover]!.tooltip ?? items[hover]!.label }}</p>
            <p class="text-gray-600 dark:text-gray-300 tabular-nums">{{ format(items[hover]!.value) }} {{ unit }}</p>
          </div>
        </div>

        <!-- X axis -->
        <div class="relative h-4 mt-1 text-[11px] text-gray-400">
          <span v-for="l in xLabels" :key="l.index" class="absolute -translate-x-1/2 whitespace-nowrap" :style="{ left: `${xPct(l.index)}%` }">{{
            l.text
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TrendItem {
  key: string
  /** Axis label. */
  label: string
  /** Tooltip / table heading, when it should say more than the axis label. */
  tooltip?: string
  value: number
}

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    items: TrendItem[]
    variant?: 'bar' | 'line'
    format?: (value: number) => string
    /** Text after the value in the tooltip, e.g. "views". */
    unit?: string
    /** Label every Nth column; 0 = first / middle / last only. */
    labelEvery?: number
    columnLabel?: string
    valueLabel?: string
    height?: string
    /** Rounds the axis top in the value's unit, e.g. niceBytesTop; default niceCeil. */
    niceTop?: (max: number) => number
  }>(),
  {
    subtitle: undefined,
    variant: 'bar',
    format: (v: number) => formatCount(v),
    unit: '',
    labelEvery: 0,
    columnLabel: 'Date',
    valueLabel: 'Value',
    height: '11rem',
    niceTop: (max: number) => niceCeil(max)
  }
)

const asTable = ref(false)
const hover = ref<number | null>(null)

const top = computed(() => props.niceTop(Math.max(0, ...props.items.map((i) => i.value))))
const ticks = computed(() => [top.value, top.value / 2, 0])

function xPct(i: number) {
  const n = props.items.length
  // Bars: column centres; line: points spread edge to edge.
  if (props.variant === 'line') return n <= 1 ? 50 : (i / (n - 1)) * 100
  return ((i + 0.5) / Math.max(n, 1)) * 100
}

const linePoints = computed(() => props.items.map((item, i) => `${xPct(i)},${100 - (item.value / top.value) * 100}`).join(' '))
const areaPoints = computed(() => (props.items.length ? `0,100 ${linePoints.value} 100,100` : ''))

const xLabels = computed(() => {
  const n = props.items.length
  if (!n) return []
  const indexes =
    props.labelEvery > 0 ? props.items.map((_, i) => i).filter((i) => i % props.labelEvery === 0) : [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
  return indexes.map((index) => ({ index, text: props.items[index]!.label }))
})

const tooltipStyle = computed(() => {
  const pct = xPct(hover.value ?? 0)
  return pct > 65 ? { right: `calc(${100 - pct}% + 10px)` } : { left: `calc(${pct}% + 10px)` }
})
</script>
