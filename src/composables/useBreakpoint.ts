import { onBeforeUnmount, onMounted, ref } from 'vue'

function useMedia(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  const update = (event: MediaQueryListEvent | MediaQueryList) => {
    matches.value = event.matches
  }
  onMounted(() => {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', update)
  })
  onBeforeUnmount(() => {
    mql?.removeEventListener('change', update)
  })
  return matches
}

export function useBreakpoint() {
  const isMobile = useMedia('(max-width: 767px)')
  const isTablet = useMedia('(min-width: 768px) and (max-width: 1023px)')
  const isDesktop = useMedia('(min-width: 1024px)')
  return { isMobile, isTablet, isDesktop }
}
