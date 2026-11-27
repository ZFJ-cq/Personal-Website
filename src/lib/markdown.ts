import { marked } from 'marked'
import DOMPurify from 'dompurify'

export interface TocItem {
  id: string
  text: string
  level: number
}

function nextId(index: number): string {
  return `h-${index + 1}`
}

/** 从 Markdown 文本中提取二级 / 三级标题，跳过代码块 */
export function extractToc(markdown: string): TocItem[] {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const items: TocItem[] = []
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = match[2].replace(/[*_`~]/g, '').trim()
    if (!text) continue
    items.push({ id: nextId(items.length), text, level: match[1].length })
  }
  return items
}

function decorate(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const headings = Array.from(doc.body.querySelectorAll('h2, h3'))
  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = nextId(index)
  })

  doc.body.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
    }
    if (/^(mailto:|tel:)/i.test(href)) return
    if (/^javascript:/i.test(href)) anchor.removeAttribute('href')
  })

  doc.body.querySelectorAll('pre').forEach((pre) => {
    const button = doc.createElement('button')
    button.className = 'code-copy'
    button.type = 'button'
    button.textContent = '复制'
    button.setAttribute('aria-label', '复制代码')
    pre.appendChild(button)
  })

  doc.body.querySelectorAll('img').forEach((img) => {
    img.setAttribute('loading', 'lazy')
    img.setAttribute('decoding', 'async')
    if (!img.getAttribute('alt')) img.setAttribute('alt', '正文配图')
  })

  return doc.body.innerHTML
}

export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return ''
  const raw = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string
  const clean = DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel', 'loading', 'decoding'],
    FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
  })
  return decorate(clean)
}
