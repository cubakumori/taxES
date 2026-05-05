import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@pages/Home.vue') },
  { path: '/conceptos', name: 'concepts', component: () => import('@pages/Concepts.vue') },
  { path: '/preparacion-ibkr', name: 'preparacion-ibkr', component: () => import('@pages/PreparacionIbkr.vue') },
  { path: '/renta-web', name: 'renta-web', component: () => import('@pages/RentaWeb.vue') },
  { path: '/imprimir', name: 'print', component: () => import('@pages/Print.vue') },
  { path: '/acerca-de', name: 'about', component: () => import('@pages/About.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 80 }
    return { top: 0 }
  },
})
