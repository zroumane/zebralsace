import { createApp } from 'vue'
import naive from 'naive-ui'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/700.css'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/700.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { renderLabel } from './render'
import { hydrateDoc } from './vars'

createApp(App).use(naive).use(router).mount('#app')

// Accès pour les tests e2e et le débogage sur site
;(window as any).__zebra = { renderLabel, hydrateDoc }
