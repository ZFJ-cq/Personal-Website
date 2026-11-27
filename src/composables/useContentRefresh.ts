import { onBeforeUnmount, onMounted } from 'vue'
import { dbMode } from '@/db'

const VERSION_KEY = 'zf.snapshotVersion'
const RELOAD_KEY = 'zf.reloadTarget'
const CHECK_MS = 3 * 60 * 1000
const MIN_GAP_MS = 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let lastCheck = 0
let checking = false

async function checkVersion() {
  if (checking || document.visibilityState !== 'visible') return
  if (dbMode.value === 'turso') return
  if (Date.now() - lastCheck < MIN_GAP_MS) return
  lastCheck = Date.now()
  checking = true
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/site-version.json?_=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return
    const data = (await res.json()) as { version?: string | number }
    const next = String(data.version ?? '')
    const applied = localStorage.getItem(VERSION_KEY) || ''
    if (!next || next === applied) return
    if (sessionStorage.getItem(RELOAD_KEY) === next) return
    sessionStorage.setItem(RELOAD_KEY, next)
    window.location.reload()
  } catch {
    /* 离线或快照不存在时忽略 */
  } finally {
    checking = false
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') void checkVersion()
}

/** 前台定时检查发布快照版本，发布完成后访客页面自动刷新 */
export function useContentRefresh() {
  onMounted(() => {
    lastCheck = Date.now()
    timer = setInterval(() => void checkVersion(), CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisible)
  })
}
