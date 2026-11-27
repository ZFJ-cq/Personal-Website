<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Copy, ImagePlus, UploadCloud } from 'lucide-vue-next'
import { isUploadConfigured, uploadImage } from '@/api/uploads'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    label?: string
    hint?: string
    aspect?: 'video' | 'square'
  }>(),
  { modelValue: '', label: '封面', hint: '16:10，留空用渐变占位', aspect: 'video' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { toast } = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const error = ref('')
const preview = ref('')
const uploaded = ref<{ path: string } | null>(null)
const copied = ref(false)

const configured = ref(isUploadConfigured())
const display = computed(() => preview.value || props.modelValue)

function syncConfig() {
  configured.value = isUploadConfigured()
}

onMounted(() => window.addEventListener('zf:publish-config', syncConfig))

function pick() {
  fileInput.value?.click()
}

function revoke() {
  if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)
  preview.value = ''
}

async function handleFile(file: File | undefined | null) {
  if (!file) return
  syncConfig()
  error.value = ''
  uploaded.value = null
  revoke()
  preview.value = URL.createObjectURL(file)

  if (!configured.value) return

  uploading.value = true
  progress.value = 0
  try {
    const result = await uploadImage(file, (percent) => (progress.value = percent))
    emit('update:modelValue', result.url)
    uploaded.value = { path: result.path }
    toast('图片已上传，链接已填入', 'success')
    // 保留本地预览：线上链接要等 Pages 部署完成后才可访问
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    uploading.value = false
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void handleFile(event.dataTransfer?.files?.[0])
}

function onInput(event: Event) {
  revoke()
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function clear() {
  emit('update:modelValue', '')
  revoke()
  uploaded.value = null
  error.value = ''
}

async function copyUrl() {
  if (!props.modelValue) return
  try {
    await navigator.clipboard.writeText(props.modelValue)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    toast('复制失败，请手动选中链接', 'error')
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  void handleFile(input.files?.[0])
  input.value = ''
}

onBeforeUnmount(() => {
  window.removeEventListener('zf:publish-config', syncConfig)
  revoke()
})
</script>

<template>
  <div>
    <label class="field-label">
      {{ label }}
      <span v-if="hint" class="ml-1 font-normal text-dim">· {{ hint }}</span>
    </label>

    <div
      class="mt-2 rounded-[12px] border border-dashed p-3 transition-colors"
      :class="dragging ? 'border-primary bg-primary/5' : 'border-line bg-bg/40'"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="flex flex-wrap items-start gap-3">
        <div
          class="relative shrink-0 overflow-hidden rounded-[10px] border border-line bg-surface2"
          :class="aspect === 'square' ? 'h-24 w-24' : 'h-24 w-[150px]'"
        >
          <img v-if="display" :src="display" alt="预览" class="h-full w-full object-cover" />
          <span v-else class="grid h-full w-full place-items-center text-dim">
            <ImagePlus :size="22" />
          </span>
          <span
            v-if="uploading"
            class="absolute inset-0 grid place-items-center bg-black/55 text-[11px] text-white"
          >
            {{ progress }}%
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn btn-sm" :disabled="uploading" @click="pick">
              <UploadCloud :size="14" /> {{ display ? '更换图片' : '选择图片' }}
            </button>
            <button v-if="display" type="button" class="btn btn-sm" :disabled="uploading" @click="clear">
              移除
            </button>
            <span class="text-[10.5px] text-dim">或拖拽图片到这里</span>
          </div>

          <p class="mt-2 text-[10.5px] leading-relaxed text-dim">
            支持 JPG / PNG / WebP / GIF，≤5MB，大图自动压缩；上传后写入
            <span class="num">public/uploads/</span> 并触发一次部署。
          </p>
          <p v-if="!configured" class="mt-1 text-[10.5px] leading-relaxed text-warn">
            未配置 Token：先在「发布」弹窗填入具备 Contents 读写权限的 GitHub Token。
          </p>
        </div>
      </div>

      <div v-if="uploading" class="mt-3">
        <div class="h-1 overflow-hidden rounded-full bg-line">
          <div class="h-full bg-primary transition-all duration-200" :style="{ width: `${progress}%` }" />
        </div>
        <p class="mt-1 text-[10.5px] text-dim">上传中 {{ progress }}%…</p>
      </div>
      <p v-if="error" class="field-error mt-2">{{ error }}</p>
      <p v-else-if="uploaded" class="mt-2 text-[10.5px] text-success">
        已提交到 {{ uploaded.path }}，Pages 部署完成后链接生效（约 1–3 分钟）。
      </p>
    </div>

    <div class="mt-2 flex gap-2">
      <input
        type="url"
        class="input flex-1"
        :value="modelValue || ''"
        placeholder="https://…（也可以直接粘贴图片链接）"
        spellcheck="false"
        @input="onInput"
      />
      <button type="button" class="btn btn-sm shrink-0" :disabled="!modelValue" @click="copyUrl">
        <component :is="copied ? Check : Copy" :size="14" />
        {{ copied ? '已复制' : '复制链接' }}
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>
