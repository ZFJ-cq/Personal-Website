import { computed, ref } from 'vue'

const AUTH_KEY = 'zf.admin.auth'
const FAIL_KEY = 'zf.admin.fails'
const LOCK_MS = 60_000
const MAX_FAILS = 5

/** 默认口令的 SHA-256；构建时可用 VITE_ADMIN_PASS_HASH 覆盖，上线请务必设置该变量 */
const DEFAULT_HASH = 'def9860a0f525a658ad6e579ef8aac6828071bd378eaeac9a5d969d0ad865160'

interface FailState {
  count: number
  until: number
}

function readFails(): FailState {
  try {
    return JSON.parse(localStorage.getItem(FAIL_KEY) || '') as FailState
  } catch {
    return { count: 0, until: 0 }
  }
}

function writeFails(state: FailState) {
  try {
    localStorage.setItem(FAIL_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export const isAuthed = ref(false)
export const lockedUntil = ref(0)

try {
  isAuthed.value = localStorage.getItem(AUTH_KEY) === '1'
  const fail = readFails()
  if (fail.until > Date.now()) lockedUntil.value = fail.until
} catch {
  /* ignore */
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function login(password: string): Promise<{ ok: boolean; message?: string }> {
  if (Date.now() < lockedUntil.value) {
    const seconds = Math.ceil((lockedUntil.value - Date.now()) / 1000)
    return { ok: false, message: `尝试过多，请 ${seconds} 秒后再试` }
  }
  const hash = await sha256(password)
  const expected = (import.meta.env.VITE_ADMIN_PASS_HASH || DEFAULT_HASH).toLowerCase()
  if (hash === expected) {
    isAuthed.value = true
    lockedUntil.value = 0
    writeFails({ count: 0, until: 0 })
    localStorage.setItem(AUTH_KEY, '1')
    return { ok: true }
  }
  const state = readFails()
  const count = state.count + 1
  if (count >= MAX_FAILS) {
    lockedUntil.value = Date.now() + LOCK_MS
    writeFails({ count: 0, until: lockedUntil.value })
    return { ok: false, message: '已连续错误 5 次，锁定 60 秒' }
  }
  writeFails({ count, until: 0 })
  return { ok: false, message: `口令不正确，还可尝试 ${MAX_FAILS - count} 次` }
}

export function logout() {
  isAuthed.value = false
  localStorage.removeItem(AUTH_KEY)
}

export function useAuth() {
  return {
    isAuthed,
    lockedUntil,
    isLocked: computed(() => Date.now() < lockedUntil.value),
    login,
    logout,
  }
}
