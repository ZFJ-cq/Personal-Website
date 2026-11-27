<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-vue-next'
import { bulkPatch, deleteWorks, duplicateWork, listWorks, reorderWorks } from '@/api/works'
import { STATUS_LABEL, type WorkStatus, type WorkWithTags } from '@/db/types'
import { useToast } from '@/composables/useToast'
import { useSiteStore } from '@/stores/site'
import { formatDate } from '@/lib/utils'
import BaseModal from '@/components/BaseModal.vue'

const route = useRoute()
const { toast } = useToast()
const site = useSiteStore()

const kind = computed<'work' | 'app'>(() => (route.meta.kind === 'app' ? 'app' : 'work'))
const label = computed(() => (kind.value === 'app' ? 'App' : '作品'))
const titleLabel = computed(() => (kind.value === 'app' ? 'App 管理' : '作品管理'))
const createLabel = computed(() => (kind.value === 'app' ? '新建 App' : '新建作品'))
const basePath = computed(() => (kind.value === 'app' ? '/admin/apps' : '/admin/works'))

const works = ref<WorkWithTags[]>([])
const loading = ref(true)
const query = ref('')
const statusFilter = ref<WorkStatus | ''>('')
const selected = ref<number[]>([])
const busy = ref(false)
const removing = ref<{ ids: number[]; label: string } | null>(null)
const dragId = ref<number | null>(null)
const dragOverId = ref<number | null>(null)

const statuses: Array<{ value: WorkStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'done', label: '已完成' },
  { value: 'wip', label: '进行中' },
  { value: 'draft', label: '草稿' },
  { value: 'archived', label: '已归档' },
]

const filtered = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return works.value.filter((work) => {
    if (statusFilter.value && work.status !== statusFilter.value) return false
    if (kw && !`${work.title} ${work.slug} ${work.category ?? ''}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every((w) => selected.value.includes(w.id)))

async function load() {
  loading.value = true
  try {
    works.value = await listWorks({ kind: kind.value, includeAll: true, limit: 200 })
    await site.reloadSettings()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    loading.value = false
  }
}

function toggleAll() {
  if (allSelected.value) {
    const ids = new Set(filtered.value.map((w) => w.id))
    selected.value = selected.value.filter((id) => !ids.has(id))
  } else {
    selected.value = Array.from(new Set([...selected.value, ...filtered.value.map((w) => w.id)]))
  }
}

function toggleOne(id: number) {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

async function duplicate(id: number) {
  if (busy.value) return
  busy.value = true
  try {
    await duplicateWork(id)
    toast('已复制，新条目为草稿状态')
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

async function move(id: number, delta: number) {
  if (busy.value) return
  const visual = filtered.value.map((w) => w.id)
  const visualIndex = visual.indexOf(id)
  const neighborId = visual[visualIndex + delta]
  if (visualIndex < 0 || neighborId === undefined) return
  const list = [...works.value]
  const index = list.findIndex((w) => w.id === id)
  const target = list.findIndex((w) => w.id === neighborId)
  if (index < 0 || target < 0) return
  const temp = list[index]
  list[index] = list[target]
  list[target] = temp
  busy.value = true
  try {
    await reorderWorks(list.map((w) => w.id))
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

function askRemove(ids: number[], name: string) {
  removing.value = { ids, label: name }
}

function onDragStart(id: number, event: DragEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.drag-handle')) {
    event.preventDefault()
    return
  }
  dragId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id))
  }
}

function onDragOver(id: number, event: DragEvent) {
  if (dragId.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverId.value = id
}

async function onDrop(targetId: number) {
  const sourceId = dragId.value
  dragId.value = null
  dragOverId.value = null
  if (sourceId === null || sourceId === targetId || busy.value) return

  const visual = filtered.value.map((w) => w.id)
  const from = visual.indexOf(sourceId)
  const to = visual.indexOf(targetId)
  if (from < 0 || to < 0) return
  visual.splice(to, 0, visual.splice(from, 1)[0])

  // 只重排当前可见条目，其余条目保持原位
  const list = [...works.value]
  const slots: number[] = []
  list.forEach((w, index) => {
    if (visual.includes(w.id)) slots.push(index)
  })
  slots.forEach((slot, i) => {
    const entry = works.value.find((w) => w.id === visual[i])
    if (entry) list[slot] = entry
  })

  busy.value = true
  try {
    await reorderWorks(list.map((w) => w.id))
    toast('排序已更新')
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

function onDragEnd() {
  dragId.value = null
  dragOverId.value = null
}

async function confirmRemove() {
  if (!removing.value) return
  const { ids } = removing.value
  busy.value = true
  try {
    await deleteWorks(ids)
    toast(ids.length > 1 ? `已删除 ${ids.length} 条` : '已删除')
    selected.value = selected.value.filter((id) => !ids.includes(id))
    removing.value = null
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

async function batch(action: 'feature' | 'unfeature' | 'archive') {
  if (!selected.value.length || busy.value) return
  busy.value = true
  try {
    if (action === 'archive') await bulkPatch(selected.value, { status: 'archived' })
    else await bulkPatch(selected.value, { featured: action === 'feature' ? 1 : 0 })
    toast(action === 'archive' ? '已归档' : action === 'feature' ? '已设为精选' : '已取消精选')
    selected.value = []
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

function onStatusChange() {
  selected.value = []
}

onMounted(async () => {
  document.title = `${titleLabel.value} · 内容后台`
  await load()
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">CONTENT / {{ kind === 'app' ? 'APPS' : 'WORKS' }}</p>
        <h1 class="mt-2 text-[22px] font-semibold">{{ titleLabel }}</h1>
        <p class="mt-1 text-[12.5px] text-dim">
          共 {{ works.length }} 条，{{ filtered.length }} 条符合筛选。排序按精选 → 自定义顺序 → 完成时间。
        </p>
      </div>
      <RouterLink :to="`${basePath}/new`" class="btn btn-primary btn-sm"><Plus :size="14" /> {{ createLabel }}</RouterLink>
    </header>

    <section class="card p-3 md:p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="item in statuses"
            :key="item.value"
            type="button"
            class="chip"
            :class="{ 'is-active': statusFilter === item.value }"
            @click="statusFilter = item.value; onStatusChange()"
          >
            {{ item.label }}
          </button>
        </div>
        <label class="relative block w-full md:w-[240px]">
          <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input v-model="query" type="search" class="input !h-9 !min-h-0 !pl-8 !text-[12.5px]" placeholder="搜索标题 / slug" />
        </label>
      </div>
    </section>

    <div v-if="loading" class="card space-y-3 p-4">
      <div v-for="i in 5" :key="i" class="skeleton h-12" />
    </div>

    <div v-else-if="!filtered.length" class="card p-10 text-center">
      <p class="text-[14px] font-medium">{{ works.length ? '没有匹配的条目' : kind === 'app' ? '还没有 App' : '还没有作品' }}</p>
      <p class="mt-1.5 text-[12.5px] text-dim">
        {{ works.length ? '清除筛选条件，或换个关键词。' : kind === 'app' ? '从一条真实的 App 测试履历开始，先写标题和正文就够。' : '从一条真实的作品开始，先写标题和正文就够。' }}
      </p>
      <button v-if="works.length" type="button" class="btn btn-sm mt-4" @click="statusFilter = ''; query = ''">清除筛选</button>
      <RouterLink v-else :to="`${basePath}/new`" class="btn btn-primary btn-sm mt-4">去新建</RouterLink>
    </div>

    <template v-else>
      <div class="hidden overflow-hidden rounded-[12px] border border-line lg:block">
        <div class="max-h-[calc(100vh-320px)] overflow-auto">
          <table class="w-full border-collapse text-left text-[12.5px]">
            <thead class="sticky top-0 z-10 bg-surface2/95 text-[11px] text-dim backdrop-blur">
              <tr>
                <th class="w-8 px-1 py-2.5" aria-label="拖拽排序" />
                <th class="w-10 px-3 py-2.5">
                  <input type="checkbox" :checked="allSelected" aria-label="全选" @change="toggleAll" />
                </th>
                <th class="px-3 py-2.5 font-medium">内容</th>
                <th class="w-24 px-3 py-2.5 font-medium">分类</th>
                <th class="w-20 px-3 py-2.5 font-medium">状态</th>
                <th class="w-16 px-3 py-2.5 font-medium">精选</th>
                <th class="w-28 px-3 py-2.5 font-medium">更新</th>
                <th class="w-[168px] px-3 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in filtered"
                :key="item.id"
                draggable="true"
                class="border-t border-line/70 transition-colors"
                :class="[
                  dragOverId === item.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : '',
                  selected.includes(item.id) ? 'bg-primary/5' : '',
                  !dragOverId && !selected.includes(item.id) ? 'hover:bg-surface/60' : '',
                  dragId === item.id ? 'opacity-50' : '',
                ]"
                @dragstart="onDragStart(item.id, $event)"
                @dragover="onDragOver(item.id, $event)"
                @drop.prevent="onDrop(item.id)"
                @dragend="onDragEnd"
              >
                <td class="px-1 py-2.5">
                  <span class="drag-handle grid h-7 w-6 cursor-grab place-items-center rounded text-dim/80 transition-colors hover:bg-primary/10 hover:text-primary active:cursor-grabbing" title="拖拽调整顺序" aria-hidden="true">
                    <GripVertical :size="13" />
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <input
                    type="checkbox"
                    :checked="selected.includes(item.id)"
                    :aria-label="`选择 ${item.title}`"
                    @change="toggleOne(item.id)"
                  />
                </td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2.5">
                  <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-line bg-surface2 text-[11px] text-dim">
                    {{ item.title.slice(0, 1) }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate font-medium">{{ item.title }}</p>
                    <p class="num truncate text-[10.5px] text-dim">{{ item.slug }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5 text-dim">{{ item.category || '—' }}</td>
              <td class="px-3 py-2.5">
                <span class="badge" :class="`badge-${item.status}`">{{ STATUS_LABEL[item.status] }}</span>
              </td>
              <td class="px-3 py-2.5">
                <Star :size="14" :class="item.featured ? 'fill-warn text-warn' : 'text-line'" />
              </td>
              <td class="num px-3 py-2.5 text-[11px] text-dim">{{ formatDate(item.updated_at, 'MM-DD HH:mm') }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center justify-end gap-0.5">
                  <button type="button" class="icon-btn !h-8 !w-8" aria-label="上移" :disabled="index === 0" @click="move(item.id, -1)">
                    <ArrowUp :size="13" />
                  </button>
                  <button type="button" class="icon-btn !h-8 !w-8" aria-label="下移" :disabled="index === filtered.length - 1" @click="move(item.id, 1)">
                    <ArrowDown :size="13" />
                  </button>
                  <RouterLink :to="`${basePath}/${item.id}/edit`" class="icon-btn !h-8 !w-8" aria-label="编辑">
                    <Pencil :size="13" />
                  </RouterLink>
                  <button type="button" class="icon-btn !h-8 !w-8" aria-label="复制" @click="duplicate(item.id)">
                    <Copy :size="13" />
                  </button>
                  <RouterLink
                    :to="`/${item.kind === 'app' ? 'apps' : 'works'}/${item.slug}`"
                    target="_blank"
                    class="icon-btn !h-8 !w-8"
                    aria-label="前台预览"
                  >
                    <ExternalLink :size="13" />
                  </RouterLink>
                  <button type="button" class="icon-btn !h-8 !w-8 hover:!text-danger" aria-label="删除" @click="askRemove([item.id], item.title)">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <div class="space-y-3 lg:hidden">
        <div
          v-for="item in filtered"
          :key="item.id"
          class="card p-3.5"
          :class="selected.includes(item.id) ? 'border-primary/40' : ''"
        >
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              class="mt-1"
              :checked="selected.includes(item.id)"
              :aria-label="`选择 ${item.title}`"
              @change="toggleOne(item.id)"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="text-[13.5px] font-medium leading-snug">{{ item.title }}</p>
                <span class="badge shrink-0" :class="`badge-${item.status}`">{{ STATUS_LABEL[item.status] }}</span>
              </div>
              <p class="num mt-0.5 truncate text-[10.5px] text-dim">{{ item.slug }}</p>
              <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-dim">
                <span>{{ item.category || '未分类' }}</span>
                <span>{{ formatDate(item.updated_at, 'MM-DD HH:mm') }}</span>
                <span v-if="item.featured" class="inline-flex items-center gap-1 text-warn"><Star :size="11" /> 精选</span>
              </div>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5 border-t border-line/70 pt-3">
            <RouterLink :to="`${basePath}/${item.id}/edit`" class="btn btn-sm"><Pencil :size="13" /> 编辑</RouterLink>
            <button type="button" class="btn btn-sm" @click="duplicate(item.id)"><Copy :size="13" /> 复制</button>
            <RouterLink
              :to="`/${item.kind === 'app' ? 'apps' : 'works'}/${item.slug}`"
              target="_blank"
              class="btn btn-sm"
            >
              <ExternalLink :size="13" /> 预览
            </RouterLink>
            <button type="button" class="btn btn-sm btn-danger ml-auto" @click="askRemove([item.id], item.title)">
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <Transition name="bar">
      <div
        v-if="selected.length"
        class="fixed inset-x-3 bottom-[76px] z-50 lg:inset-x-auto lg:bottom-6 lg:right-6"
      >
        <div class="flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-bg/95 px-4 py-3 shadow-modal backdrop-blur">
          <span class="num mr-1 text-[11.5px] text-dim">已选 {{ selected.length }}</span>
          <button type="button" class="btn btn-sm" :disabled="busy" @click="batch('feature')">设为精选</button>
          <button type="button" class="btn btn-sm" :disabled="busy" @click="batch('unfeature')">取消精选</button>
          <button type="button" class="btn btn-sm" :disabled="busy" @click="batch('archive')">归档</button>
          <button type="button" class="btn btn-sm btn-danger" :disabled="busy" @click="askRemove(selected, `选中的 ${selected.length} 条${kind === 'app' ? ' App' : '作品'}`)">
            <Trash2 :size="13" /> 删除
          </button>
          <button type="button" class="icon-btn !h-8 !w-8 ml-auto" aria-label="取消选择" @click="selected = []">✕</button>
        </div>
      </div>
    </Transition>

    <BaseModal :open="!!removing" title="确认删除" @close="removing = null">
      <p class="text-[13px] leading-relaxed">
        将删除「{{ removing?.label }}」及其全部外部链接与标签关联，此操作不可撤销。
      </p>
      <p class="mt-2 text-[12px] text-dim">建议先到「数据管理」导出一次 .db 备份。</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" :disabled="busy" @click="removing = null">取消</button>
        <button type="button" class="btn btn-sm btn-danger" :disabled="busy" @click="confirmRemove">
          {{ busy ? '删除中…' : '确认删除' }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.bar-enter-active,
.bar-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.bar-enter-from,
.bar-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
