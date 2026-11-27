<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, Search } from 'lucide-vue-next'
import { listWorks } from '@/api/works'
import type { WorkWithTags } from '@/db/types'
import { applySeo } from '@/lib/seo'
import PageContainer from '@/components/PageContainer.vue'
import WorkCard from '@/components/WorkCard.vue'

const route = useRoute()
const works = ref<WorkWithTags[]>([])
const apps = ref<WorkWithTags[]>([])
const query = ref('')

const all = computed(() => [
  ...works.value.map((w) => ({ ...w, to: `/works/${w.slug}`, group: '作品' })),
  ...apps.value.map((w) => ({ ...w, to: `/apps/${w.slug}`, group: 'App' })),
])

const results = computed(() => {
  const kw = query.value.trim().toLowerCase()
  if (!kw) return []
  return all.value
    .filter((item) => `${item.title} ${item.subtitle ?? ''}`.toLowerCase().includes(kw))
    .slice(0, 6)
})

onMounted(async () => {
  applySeo({ title: '页面未找到 · 张福建', description: '这个地址没有对应内容，回到首页或搜索作品。' })
  try {
    const [workList, appList] = await Promise.all([
      listWorks({ kind: 'work', limit: 3 }),
      listWorks({ kind: 'app', limit: 50 }),
    ])
    works.value = workList
    apps.value = appList
  } catch {
    /* 忽略：404 页仍可用 */
  }
})
</script>

<template>
  <PageContainer>
    <div class="mx-auto max-w-[640px] py-16 text-center md:py-24">
      <p class="eyebrow">ERROR / 404</p>
      <p class="font-display mt-3 text-[clamp(64px,14vw,120px)] leading-none text-primary">404</p>
      <h1 class="display-md mt-2">这个地址不在档案里</h1>
      <p class="mt-3 text-[13.5px] leading-relaxed text-dim">
        可能是链接失效，或内容已经改名。
        <span v-if="route.params.pathMatch" class="num">（{{ route.fullPath }}）</span>
      </p>

      <div class="mx-auto mt-8 max-w-[440px]">
        <label class="relative block">
          <Search :size="16" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            v-model="query"
            type="search"
            class="input !h-12 !pl-10"
            placeholder="搜索作品或 App…"
            aria-label="站内搜索"
          />
        </label>
        <ul v-if="results.length" class="card mt-3 overflow-hidden text-left">
          <li v-for="item in results" :key="item.to">
            <RouterLink
              :to="item.to"
              class="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3 text-[13px] last:border-0 hover:bg-surface2"
            >
              <span class="min-w-0 truncate">{{ item.title }}</span>
              <span class="eyebrow shrink-0">{{ item.group }}</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else-if="query.trim()" class="mt-3 text-[12px] text-dim">没有匹配项，换个关键词试试。</p>
      </div>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <RouterLink to="/" class="btn btn-primary">回首页</RouterLink>
        <RouterLink to="/works" class="btn">看全部作品 <ArrowRight :size="15" /></RouterLink>
      </div>
    </div>

    <section v-if="works.length" class="pb-16">
      <div class="mb-6 flex items-center gap-3">
        <span class="eyebrow">MAYBE YOU WANT</span>
        <span class="h-px flex-1 bg-line opacity-60" />
      </div>
      <div class="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        <WorkCard v-for="(work, i) in works" :key="work.id" :work="work" :index="i + 1" />
      </div>
    </section>
  </PageContainer>
</template>
