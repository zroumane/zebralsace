<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Template } from '../api'
import { useStatus } from '../useStatus'
import StatusBadge from './StatusBadge.vue'
import PrintDialog from './PrintDialog.vue'

const statut = useStatus()
const ETATS: Record<string, string> = {
  en_attente: 'en attente',
  envoi: 'envoi…',
  ok: 'imprimée',
  erreur: 'erreur',
}

const templates = ref<Template[]>([])
const templateChoisi = ref<Template | null>(null)

async function charger() {
  templates.value = await api.get<Template[]>('/api/templates')
}
onMounted(charger)
</script>

<template>
  <div class="kiosque">
    <header>
      <h1>Étiquettes</h1>
      <StatusBadge />
      <router-link class="lien-admin" to="/admin">Administration</router-link>
    </header>

    <div v-if="statut.file?.length" class="file" data-testid="file-impression">
      <span v-for="j in statut.file" :key="j.id" class="job" :class="j.etat">
        {{ j.template_nom }} × {{ j.quantite }} : {{ ETATS[j.etat] }}<template v-if="j.erreur_message"> — {{ j.erreur_message }}</template>
      </span>
    </div>

    <div class="grille">
      <button
        v-for="t in templates"
        :key="t.id"
        class="carte"
        :data-testid="`template-${t.id}`"
        @click="templateChoisi = t"
      >
        <img v-if="t.vignette_png" :src="t.vignette_png" :alt="t.nom" />
        <div v-else class="vide">Aperçu à venir</div>
        <span>{{ t.nom }}</span>
      </button>
      <p v-if="!templates.length" class="aucun">
        Aucun modèle d'étiquette. Créez-en un depuis l'administration.
      </p>
    </div>

    <PrintDialog
      v-if="templateChoisi"
      :template="templateChoisi"
      @close="templateChoisi = null; charger()"
    />
  </div>
</template>

<style scoped>
.kiosque { min-height: 100vh; padding: 16px 24px; }
header { display: flex; align-items: center; gap: 24px; border-bottom: 3px solid #c1121f; padding-bottom: 12px; }
h1 { flex: 1; margin: 0; font-size: 28px; }
.lien-admin { color: #999; font-size: 14px; text-decoration: none; }
.file { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 0 0; }
.job { padding: 4px 12px; border-radius: 999px; font-size: 13px; background: #f2f2f2; color: #555; }
.job.envoi { background: #fdf3e7; color: #9a5b00; }
.job.ok { background: #e8f5e9; color: #1b5e20; }
.job.erreur { background: #fdecea; color: #780000; font-weight: 700; }
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; padding: 24px 0; }
.carte {
  background: #fff; border: 2px solid #e5e5e5; border-radius: 10px;
  padding: 12px; cursor: pointer; font: inherit; text-align: center;
}
.carte:active { border-color: #c1121f; }
.carte img { width: 100%; border: 1px solid #eee; }
.carte .vide { aspect-ratio: 2; display: grid; place-items: center; color: #999; background: #f7f7f7; }
.carte span { display: block; margin-top: 8px; font-weight: 700; font-size: 18px; }
.aucun { color: #999; grid-column: 1 / -1; text-align: center; padding: 48px 0; }
</style>
