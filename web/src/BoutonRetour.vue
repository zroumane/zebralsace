<script setup lang="ts">
defineProps<{ to: string; libelle: string }>()
</script>

<template>
  <router-link class="retour" :to="to" data-testid="retour">
    <svg
      class="fleche"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
    <span>{{ libelle }}</span>
  </router-link>
</template>

<style scoped>
.retour {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 10px;
  border: 1px solid #e5e5e5;
  border-radius: 999px;
  background: #fff;
  color: #555;
  font-size: 14px;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
}
.retour:hover { border-color: #c1121f; color: #c1121f; }
.retour:hover .fleche { transform: translateX(-3px); }
.fleche { flex: none; transition: transform 0.15s; }
</style>
