<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { reglagesModifies } from './etatModifs'
import { useMessage } from 'naive-ui'
import { api } from '../api'
import BoutonRetour from '../BoutonRetour.vue'
import StatusBadge from '../kiosk/StatusBadge.vue'
import TemplatesTab from './TemplatesTab.vue'
import MediaTab from './MediaTab.vue'
import VariablesTab from './VariablesTab.vue'
import HistoryTab from './HistoryTab.vue'
import ErrorsTab from './ErrorsTab.vue'
import SettingsTab from './SettingsTab.vue'

const message = useMessage()
const route = useRoute()
const router = useRouter()

// chaque onglet a sa propre URL : /admin/modeles, /admin/medias, /admin/variables…
const ONGLETS = ['modeles', 'medias', 'variables', 'historique', 'erreurs', 'reglages']

// garde-fou réglages : vaut pour le changement d'onglet ET la navigation
function sortieReglagesConfirmee(): boolean {
  if (!reglagesModifies.value) return true
  const ok = window.confirm('Réglages non enregistrés — quitter sans enregistrer ?')
  if (ok) reglagesModifies.value = false
  return ok
}
onBeforeRouteLeave(sortieReglagesConfirmee)

const onglet = computed({
  get: () => {
    const o = String(route.params.onglet ?? '')
    return ONGLETS.includes(o) ? o : 'modeles'
  },
  set: (o: string) => {
    if (!sortieReglagesConfirmee()) return
    void router.replace(`/admin/${o}`)
  },
})
const session = ref<{ requis: boolean; connecte: boolean } | null>(null)
const mdp = ref('')

async function chargerSession() {
  session.value = await api.get<{ requis: boolean; connecte: boolean }>('/api/session')
}
onMounted(chargerSession)

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
    <header class="entete">
      <h1>Administration</h1>
      <StatusBadge />
      <BoutonRetour to="/" libelle="Retour au kiosque" />
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
      <n-tab-pane name="medias" tab="Médias"><MediaTab /></n-tab-pane>
      <n-tab-pane name="variables" tab="Variables"><VariablesTab /></n-tab-pane>
      <n-tab-pane name="historique" tab="Historique"><HistoryTab /></n-tab-pane>
      <n-tab-pane name="erreurs" tab="Erreurs"><ErrorsTab /></n-tab-pane>
      <n-tab-pane name="reglages" tab="Réglages"><SettingsTab /></n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
.admin { padding: 16px 24px; }
.login { display: flex; flex-direction: column; gap: 12px; padding: 32px 0; align-items: flex-start; }
</style>
