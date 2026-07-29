import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./kiosk/KioskView.vue') },
    { path: '/admin', component: () => import('./admin/AdminView.vue') },
    { path: '/admin/templates/:id', component: () => import('./admin/EditorView.vue') },
  ],
})
