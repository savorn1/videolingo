<template>
  <UDashboardGroup class="bg-gray-50 dark:bg-gray-950">
    <!-- Cmd/Ctrl+K anywhere in the app — items are derived straight from the
         sidebar nav below, so it can never list a page the sidebar doesn't
         also have (see searchGroups). -->
    <UDashboardSearch :groups="searchGroups" />

    <!-- Deliberately always dark, independent of the app's own light/dark
         toggle — the `dark` class forces every Nuxt UI component inside
         (nav items, icons, the collapse button) onto its dark-mode tokens
         regardless of the outer mode, so this doesn't need per-component
         overrides. -->
    <UDashboardSidebar collapsible :collapsed-size="4" class="dark bg-gray-950 border-gray-900">
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2.5" :class="collapsed ? 'justify-center w-full' : ''">
          <span class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500 text-white shrink-0">
            <UIcon name="i-lucide-languages" class="w-4 h-4" />
          </span>
          <span v-if="!collapsed" class="font-bold text-gray-900 dark:text-white tracking-tight truncate">{{ siteName }}</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <SidebarNav :items="items" :collapsed="collapsed" />
      </template>

      <template #footer>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar>
          <template #left>
            <UBreadcrumb :items="breadcrumbItems" />
          </template>

          <template #right>
            <UDashboardSearchButton />
            <InboxBell />
            <UColorModeButton />
            <UDropdownMenu :items="profileItems" :content="{ align: 'end' }" :ui="{ content: 'w-56' }">
              <UButton size="sm" color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down">
                <UAvatar :alt="username ?? '?'" size="2xs" />
                {{ username }}
              </UButton>
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>

    <!-- Shared by every page using useUnsavedChangesGuard — mounted once here so
         navigating away from a dirty form is confirmed the same way anywhere. -->
    <UnsavedChangesDialog />
  </UDashboardGroup>
</template>

<script setup lang="ts">
import type { BreadcrumbItem, DropdownMenuItem } from '@nuxt/ui'
import type { SidebarItem } from '~/components/SidebarNav.vue'

const { username, role, hasAnyAccess, logout } = useAuth()
// Settings › General
const { settings: clientSettings } = useClientSettings()
const siteName = computed(() => clientSettings.value?.siteName || 'VideoLingo')
useHead({ title: siteName })
const route = useRoute()

const profileItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: username.value ?? '',
      description: role.value === 'ADMIN' ? 'Administrator' : 'User',
      avatar: { alt: username.value ?? '?' },
      type: 'label'
    }
  ],
  [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }],
  [{ label: 'Log out', icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() }]
])

// Starter nav — add feature groups here as a top-level item with `children`,
// gating admin-only items behind `hasAnyAccess` (ADMIN always, or a USER
// whose custom role was granted at least one permission — see
// useAuth.can/middleware/admin.ts). Each group's `color` picks its accent hue
// in SidebarNav (header icon, active-item background/border).
const items = computed<SidebarItem[]>(() => [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  ...(hasAnyAccess.value ? [{ label: 'Analytics', to: '/analytics', icon: 'i-lucide-chart-no-axes-combined' }] : []),

  ...(hasAnyAccess.value
    ? [
        {
          label: 'Content',
          icon: 'i-lucide-clapperboard',
          color: 'violet',
          defaultOpen: true,
          children: [
            { label: 'Videos', to: '/videos', icon: 'i-lucide-video' },
            { label: 'Categories', to: '/categories', icon: 'i-lucide-folder-tree' },
            { label: 'Tags', to: '/tags', icon: 'i-lucide-hash' },
            { label: 'Collections', to: '/collections', icon: 'i-lucide-library' },
            { label: 'Transcripts', to: '/transcripts', icon: 'i-lucide-captions' },
            { label: 'Subtitles', to: '/subtitles', icon: 'i-lucide-subtitles' },
            { label: 'Processing jobs', to: '/processing-jobs', icon: 'i-lucide-cpu' }
          ]
        },
        {
          label: 'Notifications',
          icon: 'i-lucide-bell',
          color: 'sky',
          defaultOpen: true,
          children: [
            { label: 'Send', to: '/notifications/send', icon: 'i-lucide-send' },
            { label: 'Notifications', to: '/notifications', icon: 'i-lucide-inbox' },
            { label: 'History', to: '/notifications/history', icon: 'i-lucide-history' },
            { label: 'Templates', to: '/notifications/templates', icon: 'i-lucide-file-text' }
          ]
        },
        {
          label: 'AI',
          icon: 'i-lucide-sparkles',
          color: 'amber',
          defaultOpen: true,
          children: [
            { label: 'AI Studio', to: '/ai', icon: 'i-lucide-wand-sparkles' },
            { label: 'Usage & cost', to: '/ai/usage', icon: 'i-lucide-chart-column' }
          ]
        },
        {
          label: 'Administration',
          icon: 'i-lucide-shield',
          color: 'rose',
          defaultOpen: true,
          children: [
            { label: 'Users', to: '/users', icon: 'i-lucide-users' },
            { label: 'Languages', to: '/languages', icon: 'i-lucide-languages' },
            { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
          ]
        }
      ]
    : [])
])

// Cmd/Ctrl+K command palette — built from the exact same `items` list the
// sidebar renders, so it always matches (a route missing from one is
// missing from the other). Top-level links (Dashboard, Reports) land in
// their own unlabeled group; every collapsible section's children become a
// group of their own, suffixed with the section name so a search hit like
// "Invoices" still reads as "Invoices — Sales" if there's ever a clash.
interface SearchItem {
  id: string
  label: string
  icon?: string
  suffix?: string
  onSelect: () => void
}
const searchGroups = computed(() => {
  const groups: { id: string; label?: string; items: SearchItem[] }[] = []
  const topLevel: SearchItem[] = []
  for (const item of items.value) {
    if ('to' in item) {
      topLevel.push({ id: item.to, label: item.label, icon: item.icon, onSelect: () => navigateTo(item.to) })
    } else {
      groups.push({
        id: item.label,
        label: item.label,
        items: item.children.map((child) => ({
          id: child.to,
          label: child.label,
          icon: child.icon,
          suffix: item.label,
          onSelect: () => navigateTo(child.to)
        }))
      })
    }
  }
  if (topLevel.length > 0) groups.unshift({ id: 'top', items: topLevel })
  return groups
})

// Derived from the same nav list so it can never drift out of sync with the
// sidebar — each top-level item is now a collapsible group with `children`,
// so a page's section is whichever group's children contains its route.
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  for (const item of items.value) {
    if ('to' in item) {
      if (item.to === route.path) return [{ label: item.label, icon: item.icon }]
      continue
    }
    for (const child of item.children) {
      if (child.to === route.path) return [{ label: item.label }, { label: child.label, icon: child.icon }]
    }
  }
  // Detail routes like /videos/12 belong to their list page's nav entry — show
  // that (linked back to the list) rather than the bare id; the page's own
  // PageHeader carries the record's name.
  for (const item of items.value) {
    if ('to' in item) continue
    const parent = item.children.find((child) => child.to !== '/' && route.path.startsWith(`${child.to}/`))
    if (parent) return [{ label: item.label }, { label: parent.label, icon: parent.icon, to: parent.to }]
  }
  // Routes outside the sidebar nav (e.g. /profile) fall back to the last path segment.
  const segment = route.path.split('/').filter(Boolean).pop()
  return [{ label: segment ? humanize(segment) : 'Dashboard' }]
})
</script>
