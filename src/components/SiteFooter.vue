<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Mail } from 'lucide-vue-next'
import { useSiteStore } from '@/stores/site'
import { formatDate } from '@/lib/utils'

const site = useSiteStore()

const year = new Date().getFullYear()
const name = computed(() => site.profile.name || '张福建')
const updated = computed(() => {
  const raw = site.settings.lastPublishedAt
  if (!raw) return '本地数据'
  return formatDate(raw.replace(' ', 'T'), 'YYYY-MM-DD')
})

const links = [
  { label: '作品集', to: '/works' },
  { label: '测试过的 App', to: '/apps' },
  { label: '关于', to: '/about' },
  { label: '简历', to: '/resume' },
]
</script>

<template>
  <footer class="no-print mt-16 border-t border-line">
    <div class="wrap py-12 md:py-16">
      <div class="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div class="flex items-center gap-2.5">
            <span
              class="grid h-8 w-8 place-items-center rounded-[8px] border border-primary/40 bg-primary/10 text-[12px] font-semibold text-primary"
            >
              ZF
            </span>
            <span class="font-display text-[17px]">{{ name }}</span>
          </div>
          <p class="mt-4 max-w-[34ch] text-[13.5px] leading-relaxed text-dim">
            {{ site.profile.tagline || '把「能跑」变成「可靠」。' }}
          </p>
          <a
            v-if="site.profile.email"
            :href="`mailto:${site.profile.email}`"
            class="mt-4 inline-flex items-center gap-2 text-[13px] text-dim transition-colors hover:text-primary"
          >
            <Mail :size="14" /> {{ site.profile.email }}
          </a>
        </div>

        <nav aria-label="页脚导航">
          <p class="eyebrow">INDEX</p>
          <ul class="mt-4 space-y-2.5">
            <li v-for="item in links" :key="item.to">
              <RouterLink
                :to="item.to"
                class="link-underline text-[13.5px] text-dim transition-colors hover:text-ink"
              >
                {{ item.label }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/admin" class="link-underline text-[13.5px] text-dim transition-colors hover:text-ink">
                后台管理
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div>
          <p class="eyebrow">ELSEWHERE</p>
          <ul class="mt-4 space-y-2.5">
            <li v-for="item in site.social" :key="item.platform">
              <a
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="group inline-flex items-center gap-1.5 text-[13.5px] text-dim transition-colors hover:text-ink"
              >
                {{ item.platform }}
                <ArrowUpRight :size="13" class="text-dim transition-colors group-hover:text-primary" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-12 border-t border-line/70 pt-6">
        <div class="flex flex-col gap-3 text-[11px] leading-relaxed text-dim md:flex-row md:items-center md:justify-between">
          <p>
            本站使用匿名统计（不记录 IP、不使用 Cookie），仅用于了解内容受欢迎程度。
          </p>
          <p class="num flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>DATA UPDATED {{ updated }}</span>
            <span class="hidden h-3 w-px bg-line md:block" />
            <span>© {{ year }} {{ name }}</span>
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>
