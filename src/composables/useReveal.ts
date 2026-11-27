import { onBeforeUnmount, onMounted } from 'vue'

export function useReveal() {
  let observer: IntersectionObserver | null = null

  const refresh = () => {
    if (!observer) return
    document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)').forEach((el) => observer?.observe(el))
  }

  onMounted(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'))
      return
    }
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer?.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    refresh()
  })

  onBeforeUnmount(() => observer?.disconnect())

  return { refresh }
}
