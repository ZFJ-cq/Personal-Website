import { defineStore } from 'pinia'
import { defaultSettings, type SettingKey } from '@/db/defaults'
import type { SiteSettings } from '@/db/types'
import { getSettings, saveSetting } from '@/api/settings'
import { getSiteStats, type SiteStats } from '@/api/works'
import { applyPrimary } from '@/composables/useTheme'

interface SiteState {
  settings: SiteSettings
  stats: SiteStats
  loaded: boolean
  loading: boolean
  error: string
}

export const useSiteStore = defineStore('site', {
  state: (): SiteState => ({
    settings: defaultSettings(),
    stats: { works: 0, apps: 0, bugs: 0, cases: 0 },
    loaded: false,
    loading: false,
    error: '',
  }),
  getters: {
    profile: (state) => state.settings.profile,
    social: (state) => state.settings.social,
    modules: (state) => state.settings.modules,
    pendingChanges: (state) => state.settings.contentRevision,
  },
  actions: {
    applyDesign() {
      applyPrimary(this.settings.theme.primary)
    },
    async load(force = false) {
      if (this.loading || (this.loaded && !force)) return
      this.loading = true
      this.error = ''
      try {
        this.settings = await getSettings()
        this.stats = await getSiteStats()
        this.applyDesign()
        this.loaded = true
      } catch (error) {
        this.error = (error as Error).message
      } finally {
        this.loading = false
      }
    },
    async persist<K extends SettingKey>(key: K, value: SiteSettings[K]) {
      await saveSetting(key, value)
      this.settings = { ...this.settings, [key]: value }
      if (key === 'theme') this.applyDesign()
    },
    async reloadSettings() {
      this.settings = await getSettings()
      this.applyDesign()
    },
    async refreshStats() {
      this.stats = await getSiteStats()
    },
  },
})
