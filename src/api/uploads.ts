import { getPublishConfig } from './publish'

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const UPLOAD_DIR = 'public/uploads'

export interface UploadResult {
  /** 线上可访问的图片地址（Pages 部署后生效） */
  url: string
  /** 仓库内路径，便于在 GitHub 里查看 */
  path: string
}

export function isUploadConfigured(): boolean {
  const cfg = getPublishConfig()
  return !!cfg.repo && !!cfg.token
}

function publicOrigin(): string {
  const env = import.meta.env.VITE_SITE_URL
  const base = String(env || window.location.origin).replace(/\/+$/, '')
  return base
}

function extOf(file: File): string {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'png'
}

function assertFile(file: File) {
  if (!ALLOWED.includes(file.type)) throw new Error('仅支持 JPG / PNG / WebP / GIF')
  if (file.size > UPLOAD_MAX_BYTES) throw new Error('图片不能超过 5MB')
}

/** 大图压到最长边 1920px 并转 WebP，避免仓库和页面被拖慢 */
async function compress(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'image/gif' || file.size < 1_200_000) return { blob: file, ext: extOf(file) }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob: file, ext: extOf(file) }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88))
    bitmap.close?.()
    if (!blob) return { blob: file, ext: extOf(file) }
    return { blob, ext: 'webp' }
  } catch {
    return { blob: file, ext: extOf(file) }
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 通过 GitHub Contents API 把图片提交到 public/uploads/。
 * 需要 Token 具备该仓库的 Contents 读写权限；提交会触发一次 Pages 部署。
 */
export async function uploadImage(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
  assertFile(file)
  const cfg = getPublishConfig()
  if (!cfg.repo) throw new Error('未配置 GitHub 仓库')
  if (!cfg.token) throw new Error('缺少 GitHub Token，请先在「发布」弹窗中填写')

  const { blob, ext } = await compress(file)
  const stamp = new Date()
  const name = `img-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(
    stamp.getDate(),
  ).padStart(2, '0')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  const path = `${UPLOAD_DIR}/${name}`
  const content = await toBase64(blob)

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `https://api.github.com/repos/${cfg.repo}/contents/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${cfg.token}`)
    xhr.setRequestHeader('Accept', 'application/vnd.github+json')
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      let message = `上传失败（${xhr.status}）`
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string }
        if (body.message) message = body.message
      } catch {
        /* ignore */
      }
      if (xhr.status === 401 || xhr.status === 403) message = 'Token 无效，或缺少该仓库的 Contents 读写权限'
      if (xhr.status === 404) message = '仓库或分支不存在，请检查发布配置'
      if (xhr.status === 422) message = '同名文件已存在，请重试'
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.send(
      JSON.stringify({
        message: `chore(uploads): add ${name}`,
        content,
        branch: cfg.branch || 'main',
      }),
    )
  })

  const url = `${publicOrigin()}${import.meta.env.BASE_URL}uploads/${name}`
  if (!url.startsWith('https://')) {
    throw new Error('当前不是 https 环境，生成的链接无法使用；请设置 VITE_SITE_URL 为线上域名')
  }
  return { url, path }
}
