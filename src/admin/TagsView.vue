<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Merge, Pencil, Plus, Search, Trash2, X } from 'lucide-vue-next'
import { listTags } from '@/api/works'
import { createTag, deleteTag, mergeTags, renameTag, setTagKind } from '@/api/tags'
import { TAG_KIND_LABEL, type Tag, type TagKind } from '@/db/types'
import { useToast } from '@/composables/useToast'
import { useSiteStore } from '@/stores/site'
import BaseModal from '@/components/BaseModal.vue'

type TagRow = Tag & { count: number }

const { toast } = useToast()
const site = useSiteStore()
const tags = ref<TagRow[]>([])
const loading = ref(true)
const busy = ref(false)
const query = ref('')
const kindFilter = ref<TagKind | ''>('')
const editingId = ref(0)
const editingName = ref('')
const newName = ref('')
const newKind = ref<TagKind>('tech')
const removing = ref<TagRow | null>(null)
const merging = ref<TagRow | null>(null)
const mergeTargetId = ref(0)

const kinds: TagKind[] = ['tech', 'domain', 'testtype']

const filtered = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return tags.value.filter((tag) => {
    if (kindFilter.value && tag.kind !== kindFilter.value) return false
    if (kw && !tag.name.toLowerCase().includes(kw)) return false
    return true
  })
})

const totalRefs = computed(() => tags.value.reduce((sum, tag) => sum + tag.count, 0))
const mergeTargets = computed(() => (merging.value ? tags.value.filter((tag) => tag.id !== merging.value?.id) : []))

async function load() {
  loading.value = true
  try {
    tags.value = await listTags()
    await site.reloadSettings()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    loading.value = false
  }
}

function startEdit(tag: TagRow) {
  editingId.value = tag.id
  editingName.value = tag.name
}

async function saveEdit(tag: TagRow) {
  if (busy.value) return
  const name = editingName.value.trim()
  if (name === tag.name) {
    editingId.value = 0
    return
  }
  busy.value = true
  try {
    await renameTag(tag.id, name)
    toast('已重命名')
    editingId.value = 0
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

async function changeKind(tag: TagRow, kind: TagKind) {
  if (busy.value || tag.kind === kind) return
  busy.value = true
  try {
    await setTagKind(tag.id, kind)
    toast('已更新类型')
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

async function addTag() {
  if (busy.value) return
  const name = newName.value.trim()
  if (!name) return
  busy.value = true
  try {
    await createTag(name, newKind.value)
    toast('已创建标签')
    newName.value = ''
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

async function confirmRemove() {
  if (!removing.value) return
  busy.value = true
  try {
    await deleteTag(removing.value.id)
    toast('已删除标签及其关联')
    removing.value = null
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

async function confirmMerge() {
  if (!merging.value || !mergeTargetId.value) return
  busy.value = true
  try {
    await mergeTags(merging.value.id, mergeTargetId.value)
    toast('已合并标签')
    merging.value = null
    mergeTargetId.value = 0
    await load()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  document.title = '标签管理 · 内容后台'
  load()
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">TAXONOMY / TAGS</p>
        <h1 class="mt-2 text-[22px] font-semibold">标签管理</h1>
        <p class="mt-1 text-[12.5px] text-dim">
          {{ tags.length }} 个标签，{{ totalRefs }} 次引用。类型决定前台配色：技术蓝 / 领域紫 / 测试青。
        </p>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <input v-model="newName" class="input !h-9 !min-h-0 !text-[12.5px] sm:w-[180px]" placeholder="新标签（2–12 字）" @keydown.enter.prevent="addTag" />
        <select v-model="newKind" class="select !h-9 !min-h-0 !w-auto !text-[12px]">
          <option v-for="kind in kinds" :key="kind" :value="kind">{{ TAG_KIND_LABEL[kind] }}</option>
        </select>
        <button type="button" class="btn btn-primary btn-sm shrink-0" :disabled="busy" @click="addTag"><Plus :size="13" /> 添加</button>
      </div>
    </header>

    <section class="card flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:p-4">
      <div class="flex flex-wrap gap-1.5">
        <button type="button" class="chip" :class="{ 'is-active': !kindFilter }" @click="kindFilter = ''">全部</button>
        <button
          v-for="kind in kinds"
          :key="kind"
          type="button"
          class="chip"
          :class="kindFilter === kind ? 'is-active' : `chip-${kind}`"
          @click="kindFilter = kindFilter === kind ? '' : kind"
        >
          {{ TAG_KIND_LABEL[kind] }}
        </button>
      </div>
      <label class="relative block w-full md:w-[220px]">
        <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input v-model="query" type="search" class="input !h-9 !min-h-0 !pl-8 !text-[12.5px]" placeholder="搜索标签" />
      </label>
    </section>

    <div v-if="loading" class="card space-y-3 p-4">
      <div v-for="i in 5" :key="i" class="skeleton h-10" />
    </div>

    <div v-else-if="!filtered.length" class="card p-10 text-center">
      <p class="text-[13.5px] font-medium">没有匹配的标签</p>
      <p class="mt-1.5 text-[12px] text-dim">清除筛选，或在上方新建一个。</p>
    </div>

    <div v-else>
      <div class="hidden overflow-hidden rounded-[12px] border border-line lg:block">
        <table class="w-full border-collapse text-left text-[12.5px]">
          <thead class="bg-surface2/70 text-[11px] text-dim">
            <tr>
              <th class="px-4 py-2.5 font-medium">标签</th>
              <th class="w-36 px-3 py-2.5 font-medium">类型</th>
              <th class="w-24 px-3 py-2.5 font-medium">引用</th>
              <th class="w-[180px] px-3 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tag in filtered" :key="tag.id" class="border-t border-line/70 hover:bg-surface/60">
              <td class="px-4 py-2.5">
                <div v-if="editingId === tag.id" class="flex items-center gap-2" @keydown.enter.prevent="saveEdit(tag)" @keydown.esc="editingId = 0">
                  <input v-model="editingName" class="input !h-8 !min-h-0 !max-w-[180px] !text-[12.5px]" autofocus />
                  <button type="button" class="icon-btn !h-8 !w-8 text-success" aria-label="保存重命名" @click="saveEdit(tag)">
                    <Check :size="14" />
                  </button>
                  <button type="button" class="icon-btn !h-8 !w-8" aria-label="取消" @click="editingId = 0">
                    <X :size="14" />
                  </button>
                </div>
                <span v-else class="chip" :class="`chip-${tag.kind}`">{{ tag.name }}</span>
              </td>
              <td class="px-3 py-2.5">
                <select
                  class="select !h-8 !min-h-0 !w-[110px] !text-[11.5px]"
                  :value="tag.kind"
                  :aria-label="`修改 ${tag.name} 类型`"
                  @change="changeKind(tag, ($event.target as HTMLSelectElement).value as TagKind)"
                >
                  <option v-for="kind in kinds" :key="kind" :value="kind">{{ TAG_KIND_LABEL[kind] }}</option>
                </select>
              </td>
              <td class="num px-3 py-2.5 text-dim">{{ tag.count }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center justify-end gap-0.5">
                  <button type="button" class="icon-btn !h-8 !w-8" aria-label="重命名" @click="startEdit(tag)">
                    <Pencil :size="13" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn !h-8 !w-8"
                    aria-label="合并到其他标签"
                    :disabled="tags.length < 2"
                    @click="merging = tag; mergeTargetId = 0"
                  >
                    <Merge :size="13" />
                  </button>
                  <button type="button" class="icon-btn !h-8 !w-8 hover:!text-danger" aria-label="删除" @click="removing = tag">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="space-y-2 lg:hidden">
        <div v-for="tag in filtered" :key="tag.id" class="card p-3.5">
          <div class="flex items-center justify-between gap-3">
            <span class="chip" :class="`chip-${tag.kind}`">{{ tag.name }}</span>
            <span class="num text-[10.5px] text-dim">{{ tag.count }} 次引用</span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <select
              class="select !h-8 !min-h-0 !w-[110px] !text-[11.5px]"
              :value="tag.kind"
              :aria-label="`修改 ${tag.name} 类型`"
              @change="changeKind(tag, ($event.target as HTMLSelectElement).value as TagKind)"
            >
              <option v-for="kind in kinds" :key="kind" :value="kind">{{ TAG_KIND_LABEL[kind] }}</option>
            </select>
            <button type="button" class="btn btn-sm" @click="startEdit(tag)"><Pencil :size="12" /> 重命名</button>
            <button type="button" class="btn btn-sm" :disabled="tags.length < 2" @click="merging = tag; mergeTargetId = 0">
              <Merge :size="12" /> 合并
            </button>
            <button type="button" class="btn btn-sm btn-danger ml-auto" @click="removing = tag"><Trash2 :size="12" /></button>
          </div>
          <div v-if="editingId === tag.id" class="mt-2 flex items-center gap-2">
            <input v-model="editingName" class="input !h-8 !min-h-0 !text-[12.5px]" @keydown.enter.prevent="saveEdit(tag)" />
            <button type="button" class="btn btn-sm" @click="saveEdit(tag)">保存</button>
          </div>
        </div>
      </div>
    </div>

    <BaseModal :open="!!removing" title="删除标签" @close="removing = null">
      <p class="text-[13px] leading-relaxed">
        将删除标签「{{ removing?.name }}」并解除它与 {{ removing?.count ?? 0 }} 条内容的关联。内容本身不会被删除。
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="removing = null">取消</button>
        <button type="button" class="btn btn-sm btn-danger" :disabled="busy" @click="confirmRemove">确认删除</button>
      </div>
    </BaseModal>

    <BaseModal :open="!!merging" title="合并标签" @close="merging = null">
      <p class="text-[13px] leading-relaxed">
        把「{{ merging?.name }}」的 {{ merging?.count ?? 0 }} 次引用合并到目标标签，然后删除原标签。
      </p>
      <label class="mt-4 block">
        <span class="field-label">合并到</span>
        <select v-model="mergeTargetId" class="select">
          <option :value="0" disabled>选择一个标签</option>
          <option v-for="tag in mergeTargets" :key="tag.id" :value="tag.id">{{ tag.name }}（{{ TAG_KIND_LABEL[tag.kind] }}）</option>
        </select>
      </label>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="merging = null">取消</button>
        <button type="button" class="btn btn-sm btn-primary" :disabled="busy || !mergeTargetId" @click="confirmMerge">确认合并</button>
      </div>
    </BaseModal>
  </div>
</template>
