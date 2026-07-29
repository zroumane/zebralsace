<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Globale } from '../api'

const globales = ref<Globale[]>([])
const nouvelleCle = ref('')
const nouvelleValeur = ref('')

async function charger() {
  globales.value = await api.get<Globale[]>('/api/globals')
}
onMounted(charger)

async function ajouter() {
  const cle = nouvelleCle.value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!cle) return
  await api.put(`/api/globals/${cle}`, { valeur: nouvelleValeur.value })
  nouvelleCle.value = ''
  nouvelleValeur.value = ''
  await charger()
}
async function maj(g: Globale) {
  await api.put(`/api/globals/${g.cle}`, { valeur: g.valeur })
}
async function supprimer(g: Globale) {
  await api.del(`/api/globals/${g.cle}`)
  await charger()
}
</script>

<template>
  <div class="variables">
    <section>
      <h2>Valeurs partagées</h2>
      <!-- v-text obligatoire : des {{ }} littéraux dans le template seraient
           interprétés comme des interpolations Vue -->
      <p class="note">
        Définies une fois, utilisables dans tous les modèles avec
        <code v-text="'{{cle}}'" /> — une modification les met à jour partout.
      </p>
      <div v-for="g in globales" :key="g.cle" class="globale">
        <code v-text="'{{' + g.cle + '}}'" />
        <n-input v-model:value="g.valeur" size="small" @blur="maj(g)" />
        <n-button size="tiny" quaternary type="error" @click="supprimer(g)">Supprimer</n-button>
      </div>
      <div class="globale">
        <n-input v-model:value="nouvelleCle" size="small" placeholder="cle" data-testid="nouvelle-cle" />
        <n-input v-model:value="nouvelleValeur" size="small" placeholder="valeur" data-testid="nouvelle-valeur" />
        <n-button size="small" data-testid="ajouter-globale" @click="ajouter">Ajouter</n-button>
      </div>
    </section>

    <section>
      <h2>Variables de date (intégrées)</h2>
      <p class="note">Calculées automatiquement à chaque impression, format JJ/MM/AAAA.</p>
      <div class="globale"><code v-text="'{{date}}'" /><span>date du jour (modifiable au kiosque)</span></div>
      <div class="globale"><code v-text="'{{dlc}}'" /><span>date + durée DLC du modèle</span></div>
      <div class="globale"><code v-text="'{{date+N}}'" /><span>date du jour + N jours</span></div>
    </section>
  </div>
</template>

<style scoped>
.variables { display: flex; flex-wrap: wrap; gap: 48px; padding: 16px 0; align-items: flex-start; }
section { width: 400px; display: flex; flex-direction: column; gap: 10px; }
h2 { font-size: 16px; color: #780000; margin: 0; }
.note { font-size: 12px; color: #666; margin: 0; }
.globale { display: flex; gap: 8px; align-items: center; font-size: 13px; }
.globale code { flex: none; }
</style>
