interface SeoInput {
  title?: string
  description?: string
  image?: string
  type?: 'website' | 'article'
}

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function applySeo(input: SeoInput) {
  if (input.title) {
    document.title = input.title.length > 60 ? `${input.title.slice(0, 57)}…` : input.title
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', input.title)
  }
  if (input.description) {
    const description = input.description.slice(0, 160)
    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
  }
  if (input.image) {
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', input.image)
  }
  if (input.type) upsertMeta('meta[property="og:type"]', 'property', 'og:type', input.type)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${location.pathname}`
}

export function setJsonLd(data: Record<string, unknown> | null) {
  const id = 'zf-jsonld'
  document.getElementById(id)?.remove()
  if (!data) return
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.id = id
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}
