interface SeoInput {
  title?: string
  description?: string
  image?: string
  type?: 'website' | 'article'
}

let siteName = '技术档案'

/** 站点名由个人资料驱动；设置后同步更新已写入的 og:site_name */
export function setSiteName(name: string) {
  siteName = name || '技术档案'
  const el = document.head.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')
  if (el) el.setAttribute('content', siteName)
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
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

/** 把相对图片地址补成绝对地址，社交抓取器只认绝对 URL */
function absolute(url: string): string {
  try {
    return new URL(url, window.location.href).href
  } catch {
    return url
  }
}

function defaultImage(): string {
  return absolute(`${import.meta.env.BASE_URL}og.png`)
}

/** 当前页面的干净地址（不含查询串与哈希），用于 canonical / og:url */
function canonicalUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}

export function applySeo(input: SeoInput) {
  if (input.title) {
    const title = truncate(input.title, 60)
    document.title = title
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title)
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
  }
  if (input.description) {
    const description = truncate(input.description, 160)
    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
  }

  const image = absolute(input.image || defaultImage())
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', image)
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image)
  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')

  upsertMeta('meta[property="og:type"]', 'property', 'og:type', input.type || 'website')
  upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', siteName)
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl())

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = canonicalUrl()
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
