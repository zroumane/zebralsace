<script setup lang="ts">
import { ref } from 'vue'
import TemplatesTab from './TemplatesTab.vue'
import HistoryTab from './HistoryTab.vue'
import ErrorsTab from './ErrorsTab.vue'
import SettingsTab from './SettingsTab.vue'

const onglet = ref('modeles')
</script>

<template>
  <div class="admin">
    <header>
      <h1>Administration</h1>
      <router-link to="/">← Retour au kiosque</router-link>
    </header>
    <n-tabs v-model:value="onglet" type="line">
      <n-tab-pane name="modeles" tab="Modèles"><TemplatesTab /></n-tab-pane>
      <n-tab-pane name="historique" tab="Historique"><HistoryTab /></n-tab-pane>
      <n-tab-pane name="erreurs" tab="Erreurs"><ErrorsTab /></n-tab-pane>
      <n-tab-pane name="reglages" tab="Réglages"><SettingsTab /></n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
.admin { padding: 16px 24px; }
header { display: flex; align-items: baseline; gap: 24px; border-bottom: 3px solid #c1121f; margin-bottom: 8px; }
h1 { flex: 1; margin: 0 0 12px; font-size: 24px; }
header a { color: #999; text-decoration: none; }
</style>
