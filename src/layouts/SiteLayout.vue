<script setup lang="ts">
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import BackToTop from '@/components/BackToTop.vue'
import { useContentRefresh } from '@/composables/useContentRefresh'

useContentRefresh()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <a href="#main" class="skip-link">跳到主内容</a>
    <SiteHeader />
    <main id="main" class="flex-1">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
    <SiteFooter />
    <BackToTop />
  </div>
</template>

<style scoped>
.skip-link {
  position: fixed;
  left: 12px;
  top: 12px;
  z-index: 200;
  transform: translateY(-160%);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  padding: 8px 14px;
  font-size: 12.5px;
  transition: transform 160ms ease;
}
.skip-link:focus-visible {
  transform: translateY(0);
}
</style>
