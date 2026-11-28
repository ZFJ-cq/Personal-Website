export interface DbStatement {
  sql: string
  params?: unknown[]
}

export interface DbAdapter {
  readonly mode: 'local' | 'turso'
  init(): Promise<void>
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
  get<T>(sql: string, params?: unknown[]): Promise<T | null>
  run(sql: string, params?: unknown[]): Promise<void>
  /** 批量执行，云端可合并成一次 HTTP 请求 */
  batch?: (statements: DbStatement[]) => Promise<void>
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

/** 个人资料缺失时的兜底文案，避免页面出现空白 */
export const PROFILE_FALLBACK = {
  name: '张福建',
  school: '重庆移通学院',
  major: '计算机科学与技术',
  degree: '本科',
  gradYear: '2025 届',
  location: '重庆',
  role: '测试工程师',
} as const

/** 站点徽标，优先取英文名首字母缩写，其次取姓名首字 */
export function profileMonogram(profile: Pick<Profile, 'name' | 'enName'>): string {
  const en = profile.enName?.trim()
  if (en) {
    const parts = en.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (parts[0].length <= 2 ? parts[0] : parts[0].slice(0, 2)).toUpperCase()
  }
  return (profile.name?.trim() || PROFILE_FALLBACK.name).slice(0, 1)
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
  /** 首页 hero 下方的一段介绍，留空使用内置文案 */
  intro?: string
  /** 首页档案卡 FOCUS 行 */
  focus?: string
  /** 首页档案卡 HONOR 行 */
  honor?: string
  /** 手机号，仅在简历页展示；留空则隐藏 */
  phone?: string
  /** 学校名称，留空使用内置文案 */
  school?: string
  /** 专业名称，留空使用内置文案 */
  major?: string
  /** 学历，如「本科」 */
  degree?: string
  /** 在校时间，如「2021.09 — 2025.06」 */
  schoolPeriod?: string
  /** 毕业届别文案，如「2025 届」 */
  gradYear?: string
  /** 页脚版权起始年；留空只显示当前年 */
  copyrightSince?: number
  /** 关于页自我介绍，留空使用内置文案 */
  aboutIntro?: string
  /** 关于页技能矩阵，留空使用内置 SKILLS */
  skills?: SkillsGroup[]
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
