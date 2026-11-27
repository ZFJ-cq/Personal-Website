import seed from './seed-data.json'
import type { SiteSettings } from './types'

export function defaultSettings(): SiteSettings {
  return JSON.parse(JSON.stringify(seed.settings)) as SiteSettings
}

export const SETTING_KEYS = ['profile', 'social', 'seo', 'theme', 'modules', 'analytics'] as const
export type SettingKey = (typeof SETTING_KEYS)[number]
export const SETTING_LABEL: Record<SettingKey, string> = {
  profile: '个人资料',
  social: '社交链接',
  seo: 'SEO',
  theme: '主题',
  modules: '首页模块',
  analytics: '统计',
}
