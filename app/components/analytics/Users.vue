<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Users"
        icon="i-lucide-users"
        :value="formatCount(data?.totalUsers)"
        :sublabel="data ? `${data.enabledUsers} enabled · ${data.disabledUsers} disabled · ${data.admins} admins` : ''"
        :loading="!data"
      />
      <KpiTile
        label="New users"
        icon="i-lucide-user-plus"
        :value="formatCount(data?.newUsers.current)"
        :delta="data && describeDelta(data.newUsers.current, data.newUsers.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.newUsers.previous) : ''"
        :loading="!data"
      />
      <KpiTile
        label="Active viewers"
        icon="i-lucide-activity"
        :value="formatCount(data?.activeViewers.current)"
        :delta="data && describeDelta(data.activeViewers.current, data.activeViewers.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.activeViewers.previous) : ''"
        sublabel="Signed-in accounts that watched something"
        :loading="!data"
      />
      <KpiTile
        label="Signed in"
        icon="i-lucide-log-in"
        :value="formatCount(data?.signedInDuringPeriod)"
        :sublabel="data ? `Last sign-in in this period · ${data.neverSignedIn} never signed in` : ''"
        :loading="!data"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart v-else :title="`New users per ${newUsers.per}`" :items="newUsers.items" unit="new users" value-label="New users" />
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          :title="`Active viewers per ${active.per}`"
          :subtitle="active.per === 'week' ? 'Sum of daily active viewers' : undefined"
          :items="active.items"
          unit="viewers"
          value-label="Viewers"
        />
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">By role</h3></template>
        <RankedBarList :rows="(data?.byRole ?? []).map((r) => ({ key: r.key, label: r.key === 'ADMIN' ? 'Admins' : 'Users', value: r.count }))" />
        <template v-if="data?.byCustomRole.length">
          <p class="text-xs font-medium text-gray-500 mt-5 mb-2">Custom roles (role USER)</p>
          <RankedBarList :rows="data.byCustomRole.map((r) => ({ key: r.key, label: r.label, value: r.count }))" />
        </template>
      </UCard>
      <UCard class="lg:col-span-2">
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Top viewers</h3></template>
        <p v-if="data && !data.topViewers.length" class="text-sm text-gray-500">Nobody signed in watched anything in this period.</p>
        <table v-else class="w-full text-sm">
          <thead class="text-xs text-gray-500 text-left">
            <tr>
              <th class="pb-2 font-medium">User</th>
              <th class="pb-2 font-medium text-right">Views</th>
              <th class="pb-2 font-medium text-right">Watch time</th>
              <th class="pb-2 font-medium text-right">Finished</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="u in data?.topViewers ?? []" :key="u.userId">
              <td class="py-1.5">
                <NuxtLink :to="`/users/${u.userId}`" class="hover:underline"><UserChip :name="u.username" /></NuxtLink>
              </td>
              <td class="py-1.5 text-right tabular-nums">{{ formatCount(u.views) }}</td>
              <td class="py-1.5 text-right tabular-nums">{{ formatWatchTime(u.watchSeconds) }}</td>
              <td class="py-1.5 text-right tabular-nums">{{ u.completed }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('users', toRef(props, 'range'))

const newUsers = computed(() => trendItems(data.value?.newUsersDaily ?? []))
const active = computed(() => trendItems(data.value?.activeViewersDaily ?? []))
</script>
