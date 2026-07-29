<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { api } from '../api'
import TemplatesTab from './TemplatesTab.vue'
import HistoryTab from './HistoryTab.vue'
import ErrorsTab from './ErrorsTab.vue'
import SettingsTab from './SettingsTab.vue'

const message = useMessage()
const dialog = useDialog()
const onglet = ref('modeles')
const session = ref<{ requis: boolean; connecte: boolean } | null>(null)
const mdp = ref('')
const majSignalee = ref(false)

async function chargerSession() {
  session.value = await api.get<{ requis: boolean; connecte: boolean }>('/api/session')
  if (session.value.connecte) void verifierMaj()
}
onMounted(chargerSession)

async function verifierMaj() {
  if (majSignalee.value) return
  try {
    const maj = await api.get<{ actuelle: string; derniere?: string; disponible?: boolean }>('/api/maj')
    if (maj.disponible) {
      majSignalee.value = true
      dialog.info({
        title: 'Mise à jour disponible',
        content: `La version ${maj.derniere} est disponible (installée : ${maj.actuelle}). Lancez « deploy/mettre-a-jour.sh » sur le serveur — ou « docker compose pull » selon l'installation — pour l'appliquer.`,
        positiveText: 'Compris',
      })
    }
  } catch {
    // vérification indisponible (hors ligne, image Docker…) : silencieux
  }
}

async function connecter() {
  try {
    await api.post('/api/login', { mdp: mdp.value })
    mdp.value = ''
    await chargerSession()
  } catch (e) {
    message.error((e as Error).message)
  }
}
</script>

<template>
  <div class="admin">
    <header>
      <h1>Administration</h1>
      <router-link to="/">← Retour au kiosque</router-link>
    </header>

    <div v-if="session && session.requis && !session.connecte" class="login">
      <p>Espace protégé — entrez le mot de passe administrateur.</p>
      <n-input
        v-model:value="mdp"
        type="password"
        data-testid="mdp-admin"
        style="max-width: 260px"
        @keyup.enter="connecter"
      />
      <n-button type="primary" data-testid="se-connecter" @click="connecter">Se connecter</n-button>
    </div>

    <n-tabs v-else-if="session" v-model:value="onglet" type="line">
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
.login { display: flex; flex-direction: column; gap: 12px; padding: 32px 0; align-items: flex-start; }
</style>
