<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search, SlidersHorizontal, X } from 'lucide-vue-next'
import { listCategories, listTags, listWorks } from '@/api/works'
import type { Tag, WorkWithTags } from '@/db/types'
import { PROFILE_FALLBACK } from '@/db/types'
import { applySeo } from '@/lib/seo'
import { useSiteStore } from '@/stores/site'
import { trackSearch } from '@/analytics/collect'
import PageContainer from '@/components/PageContainer.vue'
import WorkCard from '@/components/WorkCard.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const site = useSiteStore()
const works = ref<WorkWithTags[]>([])
const categories = ref<Array<{ category: string; count: number }>>([])
const tags = ref<Array<Tag & { count: number }>>([])
const loading = ref(true)
const error = ref('')
const searchInput = ref('')
const query = ref('')
const category = ref('')
const selectedTags = ref<string[]>([])
const shown = ref(9)

const PAGE = 9
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let trackTimer: ReturnType<typeof setTimeout> | null = null

const filtered = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return works.value.filter((work) => {
    if (category.value && work.category !== category.value) return false
    if (selectedTags.value.length && !selectedTags.value.every((name) => work.tags.some((t) => t.name === name))) {
      return false
    }
    if (kw) {
      const haystack =
        `${work.title} ${work.subtitle ?? ''} ${work.summary ?? ''} ${work.category ?? ''} ${work.tags
          .map((tag) => tag.name)
          .join(' ')}`.toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })
})

const visible = computed(() => filtered.value.slice(0, shown.value))
const hasMore = computed(() => filtered.value.length > shown.value)
const hasFilters = computed(() => !!category.value || selectedTags.value.length > 0 || !!query.value.trim())

watch(searchInput, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    query.value = value
    shown.value = PAGE
  }, 300)

  if (trackTimer) clearTimeout(trackTimer)
  trackTimer = setTimeout(() => {
    const kw = value.trim()
    if (kw.length >= 2) void trackSearch(kw, filtered.value.length)
  }, 900)
})

watch([category, selectedTags], () => {
  shown.value = PAGE
})

function toggleTag(name: string) {
  selectedTags.value = selectedTags.value.includes(name)
    ? selectedTags.value.filter((t) => t !== name)
    : [...selectedTags.value, name]
}

function clearFilters() {
  category.value = ''
  selectedTags.value = []
  searchInput.value = ''
  query.value = ''
  shown.value = PAGE
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [list, cats, tagList] = await Promise.all([
      listWorks({ kind: 'work', limit: 200 }),
      listCategories('work'),
      listTags('work'),
    ])
    works.value = list
    categories.value = cats
    tags.value = tagList.filter((t) => t.kind !== 'testtype').slice(0, 14)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const name = site.profile.name || PROFILE_FALLBACK.name
  applySeo({
    title: `作品集 · ${name}`,
    description:
      site.settings.seo.description || site.profile.tagline || '做过的项目与产品归档，含背景、方案与结果。',
  })
  load()
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (trackTimer) clearTimeout(trackTimer)
})
</script>

<template>
  <PageContainer>
    <header class="pb-8 pt-10 md:pb-10 md:pt-16">
      <div class="flex items-center gap-3">
        <span class="eyebrow">ARCHIVE / WORKS</span>
        <span class="h-px flex-1 bg-line opacity-70" />
        <span class="num text-[11px] text-dim">{{ String(filtered.length).padStart(2, '0') }} ITEMS</span>
      </div>
      <h1 class="display-lg mt-4">作品集</h1>
      <p class="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        每个条目都有可验证的结果。点开看背景、我做了什么，以及上线后的数字。
      </p>
    </header>

    <section class="card p-4 md:p-5" aria-label="筛选">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="chip"
              :class="{ 'is-active': !category }"
              @click="category = ''"
            >
              全部
            </button>
            <button
              v-for="item in categories"
              :key="item.category"
              type="button"
              class="chip"
              :class="{ 'is-active': category === item.category }"
              @click="category = category === item.category ? '' : item.category"
            >
              {{ item.category }}
              <span class="num text-[10px] opacity-60">{{ item.count }}</span>
            </button>
          </div>

          <label class="relative block w-full md:w-[260px] md:shrink-0">
            <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              v-model="searchInput"
              type="search"
              class="input !h-10 !min-h-0 !pl-9 pr-9"
              placeholder="搜索标题、副标题、正文…"
              aria-label="搜索作品"
            />
            <button
              v-if="searchInput"
              type="button"
              class="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-dim hover:text-ink"
              aria-label="清空搜索"
              @click="searchInput = ''"
            >
              <X :size="14" />
            </button>
          </label>
        </div>

        <div v-if="tags.length" class="border-t border-line/70 pt-4">
          <div class="mb-2 flex items-center gap-2 text-[11px] text-dim">
            <SlidersHorizontal :size="12" /> 技术 / 领域标签（可多选）
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in tags"
              :key="tag.id"
              type="button"
              class="chip"
              :class="selectedTags.includes(tag.name) ? 'is-active' : `chip-${tag.kind}`"
              @click="toggleTag(tag.name)"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>

        <div v-if="hasFilters" class="flex items-center justify-between gap-3 text-[12px] text-dim">
          <span>已筛选 {{ filtered.length }} 条</span>
          <button type="button" class="link-underline hover:text-ink" @click="clearFilters">清除筛选</button>
        </div>
      </div>
    </section>

    <div v-if="loading" class="mt-6 grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <SkeletonCard v-for="i in 6" :key="i" />
    </div>

    <div v-else-if="error" class="card mt-6 p-8 text-center">
      <p class="text-[14px] font-medium">数据加载失败</p>
      <p class="mt-1.5 text-[12.5px] text-dim">{{ error }}</p>
      <button type="button" class="btn mt-5" @click="load">重试</button>
    </div>

    <div v-else-if="visible.length" class="mt-6 grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <WorkCard v-for="(work, i) in visible" :key="work.id" :work="work" :index="i + 1" :eager="i < 3" />
    </div>

    <div v-else class="mt-6">
      <EmptyState
        title="没有匹配的作品"
        description="换个关键词，或清除分类与标签筛选试试。"
        action-text="清除筛选"
        @action="clearFilters"
      />
    </div>

    <div v-if="hasMore" class="mt-8 flex justify-center">
      <button type="button" class="btn" @click="shown += PAGE">
        加载更多
        <span class="num text-[11px] text-dim">{{ visible.length }} / {{ filtered.length }}</span>
      </button>
    </div>
  </PageContainer>
</template>
