<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FlaskConical } from 'lucide-vue-next'
import { listWorks } from '@/api/works'
import { parseAppMeta, type WorkWithTags } from '@/db/types'
import { applySeo } from '@/lib/seo'
import { useSiteStore } from '@/stores/site'
import { formatCompact } from '@/lib/utils'
import PageContainer from '@/components/PageContainer.vue'
import AppCard from '@/components/AppCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const site = useSiteStore()
const apps = ref<WorkWithTags[]>([])
const loading = ref(true)
const error = ref('')
const selected = ref<string[]>([])

const testTypes = computed(() => {
  const map = new Map<string, number>()
  for (const app of apps.value) {
    for (const type of parseAppMeta(app.meta).test_types) {
      map.set(type, (map.get(type) ?? 0) + 1)
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const filtered = computed(() => {
  if (!selected.value.length) return apps.value
  return apps.value.filter((app) => {
    const types = parseAppMeta(app.meta).test_types
    return selected.value.some((type) => types.includes(type))
  })
})

const totals = computed(() => {
  let cases = 0
  let bugs = 0
  for (const app of apps.value) {
    const meta = parseAppMeta(app.meta)
    cases += meta.case_count
    bugs += meta.bug_total
  }
  return { cases, bugs }
})

function toggle(name: string) {
  selected.value = selected.value.includes(name)
    ? selected.value.filter((item) => item !== name)
    : [...selected.value, name]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    apps.value = await listWorks({ kind: 'app', limit: 200 })
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  applySeo({
    title: `测试过的 App · ${site.profile.name || '张福建'}`,
    description: '测试履历：被测 App、测试类型、覆盖范围、用例数、缺陷分布与结论。',
  })
  load()
})
</script>

<template>
  <PageContainer>
    <header class="pb-8 pt-10 md:pb-10 md:pt-16">
      <div class="flex items-center gap-3">
        <span class="eyebrow">ARCHIVE / TEST LOG</span>
        <span class="h-px flex-1 bg-line opacity-70" />
        <span class="num text-[11px] text-dim">{{ String(filtered.length).padStart(2, '0') }} APPS</span>
      </div>
      <h1 class="display-lg mt-4">测试过的 App</h1>
      <p class="mt-3 max-w-[56ch] text-[14px] leading-relaxed text-dim">
        不是「参与过」，是「守住了什么」。每条记录包含测试范围、真机环境、用例与缺陷数据，以及上线结论。
      </p>

      <div class="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        <div class="flex items-baseline gap-2">
          <span class="num text-[22px] leading-none">{{ formatCompact(totals.cases) }}</span>
          <span class="text-[12px] text-dim">条用例</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="num text-[22px] leading-none">{{ formatCompact(totals.bugs) }}</span>
          <span class="text-[12px] text-dim">个缺陷</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="num text-[22px] leading-none">{{ apps.length }}</span>
          <span class="text-[12px] text-dim">个被测 App</span>
        </div>
      </div>
    </header>

    <section class="card p-4 md:p-5" aria-label="按测试类型筛选">
      <div class="flex items-center gap-2 text-[11px] text-dim">
        <FlaskConical :size="12" /> 测试类型（可多选，取并集）
      </div>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <button type="button" class="chip" :class="{ 'is-active': !selected.length }" @click="selected = []">
          全部
        </button>
        <button
          v-for="type in testTypes"
          :key="type.name"
          type="button"
          class="chip"
          :class="selected.includes(type.name) ? 'is-active' : 'chip-testtype'"
          @click="toggle(type.name)"
        >
          {{ type.name }}
          <span class="num text-[10px] opacity-60">{{ type.count }}</span>
        </button>
      </div>
    </section>

    <div v-if="loading" class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="skeleton h-[160px]" />
    </div>

    <div v-else-if="error" class="card mt-6 p-8 text-center">
      <p class="text-[14px] font-medium">数据加载失败</p>
      <p class="mt-1.5 text-[12.5px] text-dim">{{ error }}</p>
      <button type="button" class="btn mt-5" @click="load">重试</button>
    </div>

    <div v-else-if="filtered.length" class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <AppCard v-for="app in filtered" :key="app.id" :work="app" />
    </div>

    <div v-else class="mt-6">
      <EmptyState
        title="没有匹配的测试履历"
        description="换一个测试类型，或清除筛选看看全部记录。"
        action-text="清除筛选"
        @action="selected = []"
      />
    </div>
  </PageContainer>
</template>
