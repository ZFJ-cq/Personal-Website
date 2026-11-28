import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/app.css'
import './styles/tokens.css'
import { initTheme } from './composables/useTheme'

initTheme()

const app = createApp(App)
app.config.errorHandler = (error, _instance, info) => {
  console.error(`[zf] 渲染异常（${info}）`, error)
}

app.use(createPinia()).use(router).mount('#app')
