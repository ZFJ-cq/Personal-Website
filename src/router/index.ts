import { createRouter, createWebHistory } from 'vue-router'
import { ensureDb } from '@/db'
import { isAuthed } from '@/composables/useAuth'
import SiteLayout from '@/layouts/SiteLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    kind?: 'work' | 'app'
  }
}

// GitHub Pages 404.html 兜底：把 /?/redirect=/works/xxx 还原为真实路由
// 必须在 createWebHistory 之前执行，否则 router 会用旧地址初始化
const params = new URLSearchParams(window.location.search)
const redirect = params.get('/redirect') || params.get('redirect')
if (redirect && redirect.startsWith('/')) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  window.history.replaceState(null, '', `${base}${redirect}`)
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 88, behavior: 'smooth' }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      component: SiteLayout,
      children: [
        { path: '', name: 'home', component: () => import('@/views/HomeView.vue') },
        { path: 'works', name: 'works', component: () => import('@/views/WorksView.vue') },
        { path: 'works/:slug', name: 'work-detail', component: () => import('@/views/WorkDetailView.vue') },
        { path: 'apps', name: 'apps', component: () => import('@/views/AppsView.vue') },
        { path: 'apps/:slug', name: 'app-detail', component: () => import('@/views/AppDetailView.vue') },
        { path: 'about', name: 'about', component: () => import('@/views/AboutView.vue') },
        { path: 'resume', name: 'resume', component: () => import('@/views/ResumeView.vue') },
        { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
      ],
    },
    { path: '/admin/login', name: 'admin-login', component: () => import('@/admin/LoginView.vue') },
    {
      path: '/admin',
      component: () => import('@/admin/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('@/admin/DashboardView.vue') },
        {
          path: 'works',
          name: 'admin-works',
          component: () => import('@/admin/ContentListView.vue'),
          meta: { kind: 'work' },
        },
        {
          path: 'works/new',
          name: 'admin-work-new',
          component: () => import('@/admin/WorkFormView.vue'),
          meta: { kind: 'work' },
        },
        {
          path: 'works/:id/edit',
          name: 'admin-work-edit',
          component: () => import('@/admin/WorkFormView.vue'),
          meta: { kind: 'work' },
        },
        {
          path: 'apps',
          name: 'admin-apps',
          component: () => import('@/admin/ContentListView.vue'),
          meta: { kind: 'app' },
        },
        {
          path: 'apps/new',
          name: 'admin-app-new',
          component: () => import('@/admin/WorkFormView.vue'),
          meta: { kind: 'app' },
        },
        {
          path: 'apps/:id/edit',
          name: 'admin-app-edit',
          component: () => import('@/admin/WorkFormView.vue'),
          meta: { kind: 'app' },
        },
        { path: 'tags', name: 'admin-tags', component: () => import('@/admin/TagsView.vue') },
        { path: 'analytics', name: 'admin-analytics', component: () => import('@/admin/AnalyticsView.vue') },
        { path: 'settings', name: 'admin-settings', component: () => import('@/admin/SettingsView.vue') },
        { path: 'data', name: 'admin-data', component: () => import('@/admin/DataView.vue') },
        { path: 'connect', name: 'admin-connect', component: () => import('@/admin/ConnectView.vue') },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  try {
    await ensureDb()
  } catch {
    // 数据源失败时页面自行展示降级态，不阻断路由
  }
  if (to.meta.requiresAuth && !isAuthed.value) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'admin-login' && isAuthed.value) {
    return { name: 'admin-dashboard' }
  }
  return true
})

router.afterEach((to) => {
  if (to.path.startsWith('/admin')) return
  void import('@/analytics/collect')
    .then((mod) => mod.track('pageview', to.fullPath))
    .catch(() => undefined)
})

export default router
