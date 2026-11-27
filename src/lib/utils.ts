import dayjs from 'dayjs'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function formatDate(value?: string | null, template = 'YYYY-MM-DD'): string {
  if (!value) return ''
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(template) : value
}

export function monthRange(start?: string | null, end?: string | null): string {
  const from = start ? formatDate(start, 'YYYY-MM') : ''
  const to = end ? formatDate(end, 'YYYY-MM') : ''
  if (from && to) return from === to ? from : `${from} → ${to}`
  if (from) return `${from} 起`
  if (to) return `${to} 完成`
  return ''
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Number.isFinite(value) ? value : 0)
}

export function formatCompact(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')} 万`
  return formatNumber(value)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const SLUG_PATTERN = /^[a-z0-9-]{2,60}$/

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

export function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
    return null
  } catch {
    return null
  }
}

export function pathOnly(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname + parsed.search
  } catch {
    return url
  }
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

export function yearsSince(year: number): number {
  return Math.max(1, new Date().getFullYear() - year)
}

export function scrollToTop(smooth = true) {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
}
