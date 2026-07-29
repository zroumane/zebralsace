<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { api, type Globale, type PrinterStatus } from '../api'
import LogoLibrary from './LogoLibrary.vue'

const message = useMessage()
const reglages = ref<Record<string, string>>({})
onMounted(async () => {
  reglages.value = await api.get<Record<string, string>>('/api/settings')
})

// n-input-number/n-slider ne savent pas lier une string : proxys numériques
const num = (cle: string) => ({
  get: () => Number(reglages.value[cle] ?? 0),
  set: (v: number | null) => (reglages.value[cle] = String(v ?? 0)),
})
const contraste = computed(num('contraste'))
const laize = computed(num('laize_mm'))
const vitesse = computed(num('vitesse'))
const offsetX = computed(num('offset_x'))
const offsetY = computed(num('offset_y'))

async function enregistrer() {
  await api.put('/api/settings', reglages.value)
  message.success('Réglages enregistrés')
}

async function tester() {
  const s = await api.get<PrinterStatus>('/api/status')
  s.pret ? message.success(s.message) : message.error(s.message)
}

const globales = ref<Globale[]>([])
const nouvelleCle = ref('')
const nouvelleValeur = ref('')
async function chargerGlobales() {
  globales.value = await api.get<Globale[]>('/api/globals')
}
onMounted(chargerGlobales)

async function ajouterGlobale() {
  const cle = nouvelleCle.value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!cle) return
  await api.put(`/api/globals/${cle}`, { valeur: nouvelleValeur.value })
  nouvelleCle.value = ''
  nouvelleValeur.value = ''
  await chargerGlobales()
}
async function majGlobale(g: Globale) {
  await api.put(`/api/globals/${g.cle}`, { valeur: g.valeur })
}
async function supprimerGlobale(g: Globale) {
  await api.del(`/api/globals/${g.cle}`)
  await chargerGlobales()
}
</script>

<template>
  <div class="reglages" v-if="Object.keys(reglages).length">
    <section>
      <h2>Imprimante</h2>
      <label>Adresse IP <n-input v-model:value="reglages.printer_ip" data-testid="ip" placeholder="192.168.1.50" /></label>
      <label>Port <n-input v-model:value="reglages.printer_port" /></label>
      <label>
        Résolution
        <n-select
          v-model:value="reglages.dpi"
          :options="[{ label: '203 dpi', value: '203' }, { label: '300 dpi', value: '300' }, { label: '600 dpi', value: '600' }]"
        />
      </label>
      <p class="note">⚠ Changer la résolution après avoir créé des modèles impose de les réajuster dans l'éditeur.</p>
      <label>Laize — largeur max d'impression (mm) <n-input-number v-model:value="laize" :min="10" :max="300" /></label>
      <label>Contraste (0–30) <n-slider v-model:value="contraste" :min="0" :max="30" /></label>
      <label>Vitesse (2–12) <n-input-number v-model:value="vitesse" :min="2" :max="12" /></label>
      <label>Décalage horizontal (points) <n-input-number v-model:value="offsetX" :min="-120" :max="120" /></label>
      <label>Décalage vertical (points) <n-input-number v-model:value="offsetY" :min="-120" :max="120" /></label>
      <div class="boutons">
        <n-button type="primary" data-testid="enregistrer-reglages" @click="enregistrer">Enregistrer</n-button>
        <n-button data-testid="tester-connexion" @click="tester">Tester la connexion</n-button>
      </div>
    </section>

    <section>
      <h2>Valeurs partagées</h2>
      <!-- v-text obligatoire : des {{ }} littéraux dans le template seraient
           interprétés comme des interpolations Vue -->
      <p class="note">Utilisables dans tous les modèles avec <code v-text="'{{cle}}'" />.</p>
      <div v-for="g in globales" :key="g.cle" class="globale">
        <code v-text="'{{' + g.cle + '}}'" />
        <n-input v-model:value="g.valeur" size="small" @blur="majGlobale(g)" />
        <n-button size="tiny" quaternary type="error" @click="supprimerGlobale(g)">Supprimer</n-button>
      </div>
      <div class="globale">
        <n-input v-model:value="nouvelleCle" size="small" placeholder="cle" data-testid="nouvelle-cle" />
        <n-input v-model:value="nouvelleValeur" size="small" placeholder="valeur" data-testid="nouvelle-valeur" />
        <n-button size="small" data-testid="ajouter-globale" @click="ajouterGlobale">Ajouter</n-button>
      </div>
    </section>

    <section>
      <h2>Bibliothèque d'images</h2>
      <LogoLibrary mode="manage" />
    </section>
  </div>
</template>

<style scoped>
.reglages { display: flex; flex-wrap: wrap; gap: 48px; padding: 16px 0; }
section { width: 340px; display: flex; flex-direction: column; gap: 10px; }
h2 { font-size: 16px; color: #780000; margin: 0; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; }
.note { font-size: 12px; color: #666; margin: 0; }
.boutons { display: flex; gap: 8px; }
.globale { display: flex; gap: 6px; align-items: center; }
</style>
