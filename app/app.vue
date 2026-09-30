<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <!-- A thin bar at the top while a page loads, so a click never seems to do nothing -->
    <NuxtLoadingIndicator color="var(--ui-primary)" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
