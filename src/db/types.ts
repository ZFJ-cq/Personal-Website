export interface DbAdapter {
  readonly mode: 'local' | 'turso'
  init(): Promise<void>
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
  get<T>(sql: string, params?: unknown[]): Promise<T | null>
  run(sql: string, params?: unknown[]): Promise<void>
  exportBinary?: () => Promise<Uint8Array>
  loadBinary?: (bytes: Uint8Array) => Promise<void>
}

export type WorkKind = 'work' | 'app'
export type WorkStatus = 'draft' | 'wip' | 'done' | 'archived'
export type LinkType = 'demo' | 'repo' | 'download' | 'store' | 'doc' | 'other'
export type TagKind = 'tech' | 'domain' | 'testtype'
export type ConclusionLevel = 'pass' | 'conditional' | 'fail'

export interface Work {
  id: number
  kind: WorkKind
  slug: string
  title: string
  subtitle: string | null
  summary: string | null
  cover_url: string | null
  category: string | null
  status: WorkStatus
  featured: number
  sort_order: number
  started_at: string | null
  finished_at: string | null
  meta: string
  created_at: string
  updated_at: string
}

export interface WorkLink {
  id: number
  work_id: number
  label: string
  url: string
  type: LinkType
  sort_order: number
}

export interface Tag {
  id: number
  name: string
  kind: TagKind
}

export interface WorkWithTags extends Work {
  tags: Tag[]
}

export interface WorkDetail extends WorkWithTags {
  links: WorkLink[]
}

export interface WorkMetric {
  label: string
  value: string
}

export interface WorkMeta {
  role?: string
  highlights?: string[]
  metrics?: WorkMetric[]
  repo_private?: boolean
}

export interface AppMeta {
  version?: string
  platforms?: string[]
  test_types?: string[]
  test_scope?: string
  test_cycle?: string
  env?: string
  case_count?: number
  bug_total?: number
  bug_p0?: number
  bug_open?: number
  conclusion?: string
  conclusion_level?: ConclusionLevel
}

export interface Profile {
  name: string
  enName: string
  tagline: string
  role: string
  avatar: string
  resumeUrl: string
  email: string
  location: string
  since: number
  availability: string
}

export interface SocialLink {
  platform: string
  label: string
  url: string
  icon: string
}

export interface Seo {
  title: string
  description: string
  keywords: string
  ogImage: string
}

export interface ThemeSetting {
  primary: string
  mode: 'dark' | 'light'
}

export interface Modules {
  stats: boolean
  featured: boolean
  apps: boolean
  skills: boolean
  contact: boolean
}

export interface AnalyticsSetting {
  enabled: boolean
  endpoint: string
  sampleRate: number
  respectDnt: boolean
  retentionDays: number
}

export interface SiteSettings {
  profile: Profile
  social: SocialLink[]
  seo: Seo
  theme: ThemeSetting
  modules: Modules
  analytics: AnalyticsSetting
  lastPublishedAt: string | null
  contentRevision: number
}

export interface SkillsGroup {
  group: string
  items: string[]
}

export const SKILLS: SkillsGroup[] = [
  { group: '测试方法', items: ['黑盒 / 等价类 · 边界值', '白盒 / 语句 · 分支覆盖', '正交试验 · 场景分析', 'IEEE 829 · GJB141 / 438B'] },
  { group: '测试工具', items: ['禅道 / Jira', 'Fiddler · F12 抓包', 'Postman / JMeter', 'Xmind 思维导图'] },
  { group: '自动化', items: ['Selenium WebDriver', 'PageObject 设计模式', 'Python Requests', 'BeautifulReport 报告'] },
  { group: '系统与数据', items: ['MySQL / SQL', 'Linux / Shell', 'FinalShell 搭环境', 'C / Java 代码阅读'] },
  { group: '前端协作', items: ['Vue 3 原理', '渲染 / 数据绑定排查', 'H5 兼容性', '性能指标分析'] },
]

export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw)
    return typeof value === 'object' && value !== null ? (value as T) : fallback
  } catch {
    return fallback
  }
}

export interface ParsedWorkMeta {
  role: string
  highlights: string[]
  metrics: WorkMetric[]
  repo_private: boolean
}

export interface ParsedAppMeta {
  version: string
  platforms: string[]
  test_types: string[]
  test_scope: string
  test_cycle: string
  env: string
  case_count: number
  bug_total: number
  bug_p0: number
  bug_open: number
  conclusion: string
  conclusion_level: ConclusionLevel
}

export function parseWorkMeta(raw: string | null): ParsedWorkMeta {
  const meta = safeParse<WorkMeta>(raw, {})
  return {
    role: typeof meta.role === 'string' ? meta.role : '',
    highlights: Array.isArray(meta.highlights) ? meta.highlights.filter((h) => typeof h === 'string') : [],
    metrics: Array.isArray(meta.metrics)
      ? meta.metrics.filter((m) => m && typeof m.label === 'string' && typeof m.value === 'string')
      : [],
    repo_private: meta.repo_private === true,
  }
}

export function parseAppMeta(raw: string | null): ParsedAppMeta {
  const meta = safeParse<AppMeta>(raw, {})
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const level: ConclusionLevel =
    meta.conclusion_level === 'conditional' || meta.conclusion_level === 'fail' ? meta.conclusion_level : 'pass'
  return {
    version: typeof meta.version === 'string' ? meta.version : '',
    platforms: Array.isArray(meta.platforms) ? meta.platforms.filter((p) => typeof p === 'string') : [],
    test_types: Array.isArray(meta.test_types) ? meta.test_types.filter((p) => typeof p === 'string') : [],
    test_scope: typeof meta.test_scope === 'string' ? meta.test_scope : '',
    test_cycle: typeof meta.test_cycle === 'string' ? meta.test_cycle : '',
    env: typeof meta.env === 'string' ? meta.env : '',
    case_count: num(meta.case_count),
    bug_total: num(meta.bug_total),
    bug_p0: num(meta.bug_p0),
    bug_open: num(meta.bug_open),
    conclusion: typeof meta.conclusion === 'string' ? meta.conclusion : '',
    conclusion_level: level,
  }
}

export const STATUS_LABEL: Record<WorkStatus, string> = {
  draft: '草稿',
  wip: '进行中',
  done: '已完成',
  archived: '已归档',
}

export const CONCLUSION_LABEL: Record<ConclusionLevel, string> = {
  pass: '通过',
  conditional: '有条件通过',
  fail: '未通过',
}

export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  demo: '在线演示',
  repo: '代码仓库',
  download: '下载',
  store: '应用商店',
  doc: '文档',
  other: '链接',
}

export const TAG_KIND_LABEL: Record<TagKind, string> = {
  tech: '技术栈',
  domain: '领域',
  testtype: '测试类型',
}
