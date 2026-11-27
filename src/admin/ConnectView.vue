<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Cloud, Database, Eye, EyeOff, HardDrive, Plug, ShieldCheck, Unplug } from 'lucide-vue-next'
import { connectTurso, dbMode, disconnectTurso, readTursoConfig } from '@/db'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/BaseModal.vue'

const site = useSiteStore()
const { toast } = useToast()

const saved = readTursoConfig()
const url = ref(saved.url)
const token = ref(saved.token)
const showToken = ref(false)
const busy = ref('')
const error = ref('')
const confirmLocal = ref(false)

const isTurso = () => dbMode.value === 'turso'

async function connect() {
  if (busy.value) return
  const cleanUrl = url.value.trim()
  const cleanToken = token.value.trim()
  if (!/^(libsql|https):\/\//.test(cleanUrl)) {
    error.value = 'URL 格式不正确。Turso 地址通常以 libsql:// 开头，可在控制台复制。'
    return
  }
  if (cleanToken.length < 20) {
    error.value = 'Token 看起来不完整。请在 Turso 控制台创建数据库令牌后完整粘贴。'
    return
  }
  busy.value = 'connect'
  error.value = ''
  try {
    await connectTurso(cleanUrl, cleanToken)
    await site.load(true)
    toast('已连接云端数据源，正在重新加载…')
    window.setTimeout(() => window.location.reload(), 700)
  } catch (err) {
    error.value = `连接失败：${(err as Error).message}。可能是 URL 或 Token 失效、数据库被删除，或当前网络无法访问 Turso；请到控制台重新复制后重试。`
  } finally {
    busy.value = ''
  }
}

async function disconnect() {
  if (busy.value) return
  busy.value = 'disconnect'
  try {
    await disconnectTurso()
    await site.load(true)
    confirmLocal.value = false
    toast('已切回本地数据源，正在重新加载…')
    window.setTimeout(() => window.location.reload(), 700)
  } catch (err) {
    toast((err as Error).message, 'error')
  } finally {
    busy.value = ''
  }
}

onMounted(() => {
  document.title = '数据源连接 · 内容后台'
})
</script>

<template>
  <div class="space-y-5">
    <header>
      <p class="eyebrow">INFRA / CONNECTION</p>
      <h1 class="mt-2 text-[22px] font-semibold">数据源连接</h1>
      <p class="mt-1 text-[12.5px] text-dim">本地模式零配置；连接 Turso 后可在任意设备编辑同一份云端 SQLite。</p>
    </header>

    <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div class="space-y-4">
        <section class="card p-4 md:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface2" :class="isTurso() ? 'text-success' : 'text-warn'">
                <Database :size="16" />
              </span>
              <div>
                <p class="text-[13.5px] font-medium">当前数据源</p>
                <p class="num text-[10.5px] text-dim">{{ isTurso() ? 'TURSO / CLOUD' : 'LOCAL / INDEXEDDB' }}</p>
              </div>
            </div>
            <span class="badge" :class="isTurso() ? 'badge-done' : 'badge-wip'">{{ isTurso() ? '云端已连接' : '本地模式' }}</span>
          </div>

          <p class="mt-4 text-[12px] leading-relaxed text-dim">
            <template v-if="isTurso()">
              所有读写直接走 Turso 的 HTTP 接口，换电脑或手机登录后台输入同一组 URL 与 Token 即可继续维护。
            </template>
            <template v-else>
              数据保存在当前浏览器的 IndexedDB 里。换设备、清缓存前，请先在「数据管理」导出一份 .db 备份。
            </template>
          </p>

          <div class="mt-5 rounded-[10px] border border-line bg-bg p-4">
            <div class="flex items-start gap-2.5">
              <HardDrive :size="16" class="mt-0.5 shrink-0 text-dim" />
              <div class="min-w-0 flex-1">
                <p class="text-[12.5px]">Turso URL</p>
                <input v-model="url" class="input num mt-1.5 !h-9 !min-h-0 !text-[12px]" placeholder="libsql://your-db.turso.io" :disabled="busy === 'connect'" />
              </div>
            </div>
            <div class="mt-4 flex items-start gap-2.5">
              <ShieldCheck :size="16" class="mt-0.5 shrink-0 text-dim" />
              <div class="min-w-0 flex-1">
                <p class="text-[12.5px]">Auth Token</p>
                <div class="relative mt-1.5">
                  <input
                    v-model="token"
                    :type="showToken ? 'text' : 'password'"
                    class="input num !h-9 !min-h-0 pr-10 !text-[12px]"
                    placeholder="eyJhbGciOi…"
                    :disabled="busy === 'connect'"
                    autocomplete="off"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-dim hover:text-ink"
                    :aria-label="showToken ? '隐藏 Token' : '显示 Token'"
                    @click="showToken = !showToken"
                  >
                    <EyeOff v-if="showToken" :size="14" />
                    <Eye v-else :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <p v-if="error" class="mt-3 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
              {{ error }}
            </p>

            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary btn-sm" :disabled="busy === 'connect'" @click="connect">
                <Plug :size="14" /> {{ busy === 'connect' ? '连接中…' : '连接并校验' }}
              </button>
              <button v-if="isTurso()" type="button" class="btn btn-sm btn-danger" :disabled="!!busy" @click="confirmLocal = true">
                <Unplug :size="14" /> 断开并切回本地
              </button>
            </div>
            <p class="mt-3 text-[11px] leading-relaxed text-dim">
              Token 只写入当前浏览器的 localStorage，不进入代码仓库与构建产物。建议只授予该库写权限，并定期轮换。
            </p>
          </div>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="card p-4 md:p-5">
          <div class="flex items-center gap-2">
            <Cloud :size="15" class="text-primary" />
            <h2 class="text-[13.5px] font-medium">两种模式怎么选</h2>
          </div>
          <ul class="mt-3 space-y-3 text-[11.5px] leading-relaxed text-dim">
            <li><span class="text-ink">本地</span>：零成本、无需账号，适合先跑起来；数据只在本机浏览器。</li>
            <li><span class="text-ink">Turso</span>：多设备同步、数据真正持久；免费额度足够个人站。</li>
            <li>两者共用同一套 SQL 与界面，随时可切换，导出 .db 后也能互相导入。</li>
          </ul>
        </section>

        <section class="card p-4 md:p-5">
          <h2 class="text-[13.5px] font-medium">安全边界</h2>
          <ul class="mt-3 space-y-2 text-[11.5px] leading-relaxed text-dim">
            <li>站点口令只用于挡住随手访问，不是真正的安全边界。</li>
            <li>真正的边界是 Turso Token：只存本机、可随时吊销。</li>
            <li>前台不持有 Token，只读构建快照或本地数据。</li>
            <li>所有写操作都会记录到 admin_audit。</li>
          </ul>
        </section>
      </aside>
    </div>

    <BaseModal :open="confirmLocal" title="切回本地数据源" @close="confirmLocal = false">
      <p class="text-[13px] leading-relaxed">
        断开 Turso 后，后台将改为读取当前浏览器里的本地数据库。云端数据不会被删除，重新连接即可恢复。
      </p>
      <p class="mt-2 text-[11.5px] text-dim">如果本地库是空的，会写入一份内置种子数据。</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="confirmLocal = false">取消</button>
        <button type="button" class="btn btn-sm btn-danger" :disabled="busy === 'disconnect'" @click="disconnect">确认断开</button>
      </div>
    </BaseModal>
  </div>
</template>
