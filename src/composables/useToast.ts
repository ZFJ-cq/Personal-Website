import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  actionLabel?: string
  onAction?: () => void
}

let seq = 0
export const toasts = ref<ToastItem[]>([])

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function pushToast(
  message: string,
  type: ToastType = 'success',
  options: { duration?: number; actionLabel?: string; onAction?: () => void } = {},
): number {
  const id = ++seq
  toasts.value = [...toasts.value.slice(-2), { id, message, type, ...options }]
  const duration = options.duration ?? (type === 'error' ? 5000 : 2500)
  window.setTimeout(() => dismissToast(id), duration)
  return id
}

export function useToast() {
  return {
    toasts,
    toast: pushToast,
    error: (message: string) => pushToast(message, 'error'),
    info: (message: string) => pushToast(message, 'info'),
    dismiss: dismissToast,
  }
}
