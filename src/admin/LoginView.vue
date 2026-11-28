<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-vue-next'
import { login, lockedUntil } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const password = ref('')
const show = ref(false)
const loading = ref(false)
const message = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const locked = computed(() => lockedUntil.value > now.value)
const remain = computed(() => Math.max(0, Math.ceil((lockedUntil.value - now.value) / 1000)))

async function submit() {
  if (loading.value || locked.value) return
  if (!password.value.trim()) {
    message.value = '请输入口令'
    return
  }
  loading.value = true
  message.value = ''
  try {
    const result = await login(password.value)
    if (result.ok) {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
      await router.replace(redirect.startsWith('/admin') ? redirect : '/admin')
    } else {
      message.value = result.message || '登录失败'
      password.value = ''
    }
  } catch {
    message.value = '浏览器不支持加密校验，请更换现代浏览器重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  document.title = '后台登录 · 张福建'
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-[1.1fr_0.9fr]">
    <section class="relative hidden overflow-hidden border-r border-line bg-surface/40 p-10 lg:flex lg:flex-col lg:justify-between">
      <div
        class="pointer-events-none absolute inset-0 opacity-60"
        style="
          background-image:
            linear-gradient(rgb(var(--primary-rgb) / 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgb(var(--primary-rgb) / 0.07) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(80% 70% at 30% 20%, #000, transparent 75%);
        "
        aria-hidden="true"
      />
      <div class="relative flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-[9px] border border-primary/40 bg-primary/10 text-[12px] font-semibold text-primary">ZF</span>
        <span class="eyebrow">CONTENT OPERATIONS</span>
      </div>

      <div class="relative">
        <p class="eyebrow">PRIVATE AREA / 001</p>
        <h1 class="font-display mt-4 max-w-[12ch] text-[clamp(36px,4.6vw,56px)] leading-[1.1]">
          内容管理<br />控制台
        </h1>
        <p class="mt-5 max-w-[36ch] text-[13.5px] leading-relaxed text-dim">
          维护作品、测试履历与站点资料。所有写操作都会记录在审计日志里，改动可导出为 SQLite 备份。
        </p>
      </div>

      <div class="relative grid max-w-[420px] grid-cols-3 gap-4 border-t border-line pt-6">
        <div>
          <p class="num text-[20px] leading-none">CRUD</p>
          <p class="mt-1.5 text-[11px] text-dim">作品与链接</p>
        </div>
        <div>
          <p class="num text-[20px] leading-none">SQLite</p>
          <p class="mt-1.5 text-[11px] text-dim">本地 / Turso</p>
        </div>
        <div>
          <p class="num text-[20px] leading-none">STATS</p>
          <p class="mt-1.5 text-[11px] text-dim">匿名访客统计</p>
        </div>
      </div>
    </section>

    <section class="flex flex-col justify-center px-6 py-12 md:px-12">
      <div class="mx-auto w-full max-w-[360px]">
        <div class="flex items-center justify-between lg:hidden">
          <div class="flex items-center gap-2">
            <span class="grid h-8 w-8 place-items-center rounded-[8px] border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary">ZF</span>
            <span class="text-[13.5px] font-medium">内容后台</span>
          </div>
          <RouterLink to="/" class="text-[11.5px] text-dim hover:text-ink">返回前台</RouterLink>
        </div>

        <div class="mt-10 lg:mt-0">
          <div class="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface2 text-primary">
            <LockKeyhole :size="18" />
          </div>
          <h2 class="mt-5 text-[22px] font-semibold">输入管理口令</h2>
          <p class="mt-1.5 text-[12.5px] leading-relaxed text-dim">
            仅站点主人可访问。连续错误 5 次将锁定 60 秒。
          </p>

          <form class="mt-7 space-y-4" @submit.prevent="submit">
            <div>
              <label for="admin-pass" class="field-label">口令 <span class="req">*</span></label>
              <div class="relative">
                <input
                  id="admin-pass"
                  v-model="password"
                  :type="show ? 'text' : 'password'"
                  class="input pr-11"
                  :class="message ? 'is-error' : ''"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  :disabled="loading || locked"
                  autofocus
                />
                <button
                  type="button"
                  class="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-dim hover:text-ink"
                  :aria-label="show ? '隐藏口令' : '显示口令'"
                  @click="show = !show"
                >
                  <EyeOff v-if="show" :size="15" />
                  <Eye v-else :size="15" />
                </button>
              </div>
              <p v-if="message" class="field-error" role="alert">{{ message }}</p>
              <p v-else-if="locked" class="field-error" role="alert">尝试过多，请 {{ remain }} 秒后再试</p>
            </div>

            <button type="submit" class="btn btn-primary w-full" :disabled="loading || locked">
              {{ loading ? '校验中…' : locked ? `锁定中 ${remain}s` : '进入后台' }}
            </button>
          </form>

          <RouterLink to="/" class="mt-6 inline-flex items-center gap-1.5 text-[12px] text-dim hover:text-ink">
            <ArrowLeft :size="13" /> 返回个人官网
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
