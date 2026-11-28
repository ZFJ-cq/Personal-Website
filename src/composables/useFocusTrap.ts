import { onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 把键盘焦点限制在弹层内部，关闭时还原到打开前的元素。
 * 用于 BaseModal 与移动端抽屉。
 */
export function useFocusTrap(getElement: () => HTMLElement | null, isOpen: Ref<boolean>) {
  let previous: HTMLElement | null = null

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return
    const root = getElement()
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0,
    )
    if (!nodes.length) {
      event.preventDefault()
      root.focus()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement as HTMLElement | null
    const inside = active ? root.contains(active) : false
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(isOpen, (open) => {
    if (open) {
      previous = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown, true)
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      previous?.focus?.()
      previous = null
    }
  })

  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true))
}
