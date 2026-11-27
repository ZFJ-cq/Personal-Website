import { ref } from 'vue'

export type ThemeMode = 'dark' | 'light'
const KEY = 'zf.theme'

function readInitial(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export const theme = ref<ThemeMode>(readInitial())

function apply(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'light' ? '#f4f2ec' : '#080a0d')
}

export function initTheme() {
  apply(theme.value)
}

export function setTheme(mode: ThemeMode) {
  theme.value = mode
  apply(mode)
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
}

export function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

export function applyPrimary(hex: string) {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  document.documentElement.style.setProperty('--primary-rgb', `${r} ${g} ${b}`)
}

export function useTheme() {
  return { theme, setTheme, toggleTheme, applyPrimary }
}
