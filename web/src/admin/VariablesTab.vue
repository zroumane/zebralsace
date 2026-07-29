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
    <h2>Valeurs partagées</h2>
    <!-- v-text obligatoire : des {{ }} littéraux dans le template seraient
         interprétés comme des interpolations Vue -->
    <p class="note">
      Définies une fois, utilisables dans tous les modèles avec
      <code v-text="'{{cle}}'" /> — une modification les met à jour partout.
    </p>

    <table>
      <thead>
        <tr>
          <th class="col-variable">Variable</th>
          <th>Valeur</th>
          <th class="col-action"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="g in globales" :key="g.cle">
          <td><code v-text="'{{' + g.cle + '}}'" /></td>
          <td><n-input v-model:value="g.valeur" placeholder="" @blur="maj(g)" /></td>
          <td>
            <n-button size="small" quaternary type="error" @click="supprimer(g)">Supprimer</n-button>
          </td>
        </tr>
        <tr class="ajout">
          <td>
            <n-input v-model:value="nouvelleCle" placeholder="cle" data-testid="nouvelle-cle" @keyup.enter="ajouter" />
          </td>
          <td>
            <n-input v-model:value="nouvelleValeur" placeholder="valeur" data-testid="nouvelle-valeur" @keyup.enter="ajouter" />
          </td>
          <td>
            <n-button size="small" type="primary" data-testid="ajouter-globale" @click="ajouter">Ajouter</n-button>
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Variables de date (intégrées)</h2>
    <p class="note">Calculées automatiquement à chaque impression, format JJ/MM/AAAA.</p>
    <table>
      <tbody>
        <tr>
          <td class="col-variable"><code v-text="'{{date}}'" /></td>
          <td>Date du jour (modifiable au kiosque au moment d'imprimer)</td>
        </tr>
        <tr>
          <td class="col-variable"><code v-text="'{{dlc}}'" /></td>
          <td>Date du jour + durée DLC définie sur le modèle</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.variables { padding: 16px 0; }
h2 { font-size: 16px; color: #780000; margin: 0 0 6px; }
h2 + .note { margin-bottom: 12px; }
.note { font-size: 12px; color: #666; margin: 0; }
table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
th { text-align: left; font-size: 12px; color: #999; font-weight: 700; padding: 6px 10px; border-bottom: 1px solid #e5e5e5; }
td { padding: 6px 10px; border-bottom: 1px solid #f2f2f2; font-size: 14px; }
.col-variable { width: 220px; }
.col-action { width: 110px; }
.ajout td { background: #fafafa; }
code { white-space: nowrap; }
</style>
