<template>
  <div class="flex-1 overflow-y-auto py-3" :class="collapsed ? 'px-2' : 'px-3'">
    <template v-if="!collapsed">
      <div v-for="(item, i) in items" :key="item.label" :class="i > 0 ? 'mt-4' : ''">
        <NuxtLink
          v-if="isLink(item)"
          :to="item.to"
          class="flex items-center gap-2.5 rounded-xl border-l-[3px] border-transparent px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(item.to) ? 'bg-primary-400/15 border-primary-400 text-primary-400 font-semibold' : 'text-gray-300 hover:text-white hover:bg-gray-800'
          "
        >
          <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <template v-else>
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:bg-gray-800/60"
            :class="accent(item.color).headerHover"
            @click="toggle(item.label)"
          >
            <span class="flex items-center gap-2">
              <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4 shrink-0" :class="accent(item.color).headerIcon" />
              <span>{{ item.label }}</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4 shrink-0 transition-transform duration-200" :class="isOpen(item) ? 'rotate-90' : ''" />
          </button>
          <div v-show="isOpen(item)" class="space-y-0.5 mb-1">
            <NuxtLink
              v-for="child in item.children"
              :key="child.to"
              :to="child.to"
              class="flex items-center gap-2.5 rounded-xl border-l-[3px] border-transparent px-3 py-2 text-sm font-medium transition-colors"
              :class="
                isActive(child.to)
                  ? [accent(item.color).active, accent(item.color).activeBar, 'font-semibold']
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              "
            >
              <UIcon :name="child.icon" class="w-4 h-4 shrink-0" :class="isActive(child.to) ? accent(item.color).activeIcon : 'text-gray-500'" />
              <span>{{ child.label }}</span>
            </NuxtLink>
          </div>
        </template>
      </div>
    </template>

    <!-- Collapsed: flat icon-only rail, grouping dropped, label shown as a hover tooltip. -->
    <template v-else>
      <UTooltip v-for="link in flatLinks" :key="link.to" :text="link.label" :content="{ side: 'right' }">
        <NuxtLink
          :to="link.to"
          class="relative w-10 h-10 mx-auto mb-1 flex items-center justify-center rounded-xl transition-colors"
          :class="isActive(link.to) ? 'text-primary-400 bg-primary-400/15' : 'text-gray-500 hover:text-white hover:bg-gray-800'"
        >
          <UIcon :name="link.icon" class="w-5 h-5 shrink-0" />
          <span v-if="isActive(link.to)" class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary-400" />
        </NuxtLink>
      </UTooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
export interface SidebarLink {
  label: string
  to: string
  icon: string
}

export interface SidebarGroup {
  label: string
  icon?: string
  /** One of the SidebarNav accent hues — see GROUP_ACCENTS. Falls back to primary. */
  color?: string
  /** Starts expanded even when it doesn't contain the active route. */
  defaultOpen?: boolean
  children: SidebarLink[]
}

export type SidebarItem = SidebarLink | SidebarGroup

const props = defineProps<{ items: SidebarItem[]; collapsed?: boolean }>()

const route = useRoute()

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function isGroup(item: SidebarItem): item is SidebarGroup {
  return 'children' in item
}

function isLink(item: SidebarItem): item is SidebarLink {
  return 'to' in item
}

function groupIsActive(group: SidebarGroup) {
  return group.children.some((link) => isActive(link.to))
}

const openOverrides = ref<Record<string, boolean>>({})
function isOpen(group: SidebarGroup) {
  return openOverrides.value[group.label] ?? (group.defaultOpen || groupIsActive(group))
}
function toggle(label: string) {
  const group = props.items.find((item): item is SidebarGroup => isGroup(item) && item.label === label)
  if (group) openOverrides.value[label] = !isOpen(group)
}

const flatLinks = computed<SidebarLink[]>(() => props.items.flatMap((item) => (isGroup(item) ? item.children : [item])))

const GROUP_ACCENTS: Record<string, { headerIcon: string; headerHover: string; active: string; activeIcon: string; activeBar: string }> = {
  sky: {
    headerIcon: 'text-sky-400',
    headerHover: 'hover:text-sky-400',
    active: 'text-sky-400 bg-sky-400/10',
    activeIcon: 'text-sky-400',
    activeBar: 'border-sky-400'
  },
  violet: {
    headerIcon: 'text-violet-400',
    headerHover: 'hover:text-violet-400',
    active: 'text-violet-400 bg-violet-400/10',
    activeIcon: 'text-violet-400',
    activeBar: 'border-violet-400'
  },
  teal: {
    headerIcon: 'text-teal-400',
    headerHover: 'hover:text-teal-400',
    active: 'text-teal-400 bg-teal-400/10',
    activeIcon: 'text-teal-400',
    activeBar: 'border-teal-400'
  },
  orange: {
    headerIcon: 'text-orange-400',
    headerHover: 'hover:text-orange-400',
    active: 'text-orange-400 bg-orange-400/10',
    activeIcon: 'text-orange-400',
    activeBar: 'border-orange-400'
  },
  emerald: {
    headerIcon: 'text-emerald-400',
    headerHover: 'hover:text-emerald-400',
    active: 'text-emerald-400 bg-emerald-400/10',
    activeIcon: 'text-emerald-400',
    activeBar: 'border-emerald-400'
  },
  indigo: {
    headerIcon: 'text-indigo-400',
    headerHover: 'hover:text-indigo-400',
    active: 'text-indigo-400 bg-indigo-400/10',
    activeIcon: 'text-indigo-400',
    activeBar: 'border-indigo-400'
  },
  rose: {
    headerIcon: 'text-rose-400',
    headerHover: 'hover:text-rose-400',
    active: 'text-rose-400 bg-rose-400/10',
    activeIcon: 'text-rose-400',
    activeBar: 'border-rose-400'
  },
  amber: {
    headerIcon: 'text-amber-400',
    headerHover: 'hover:text-amber-400',
    active: 'text-amber-400 bg-amber-400/10',
    activeIcon: 'text-amber-400',
    activeBar: 'border-amber-400'
  }
}
const DEFAULT_ACCENT = {
  headerIcon: 'text-gray-400',
  headerHover: 'hover:text-primary-400',
  active: 'text-primary-400 bg-primary-400/10',
  activeIcon: 'text-primary-400',
  activeBar: 'border-primary-400'
}
function accent(color?: string) {
  return (color && GROUP_ACCENTS[color]) || DEFAULT_ACCENT
}
</script>
