import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/app.css'
import './styles/tokens.css'
import { initTheme } from './composables/useTheme'

initTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
