<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, type LigneResumeJour } from '../api'

// jamais toISOString ici : à minuit passé, l'UTC donnerait la veille (même
// règle que PrintDialog pour la date de fabrication)
const versIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const aujourdhui = () => versIso(new Date())

const date = ref(aujourdhui())
const lignes = ref<LigneResumeJour[]>([])
const chargement = ref(false)

async function charger() {
  chargement.value = true
  try {
    lignes.value = await api.get<LigneResumeJour[]>(`/api/print-log/jour?date=${date.value}`)
  } finally {
    chargement.value = false
  }
}
charger()
watch(date, charger)

function changerJour(delta: number) {
  const d = new Date(date.value)
  d.setDate(d.getDate() + delta)
  const suivant = versIso(d)
  if (suivant <= aujourdhui()) date.value = suivant
}

const estAujourdhui = computed(() => date.value === aujourdhui())
const dateAffichee = computed(() => {
  const [aaaa, mm, jj] = date.value.split('-')
  return `${jj}/${mm}/${aaaa}`
})

// une ligne par modèle, cartons et lots comptés séparément
const parModele = computed(() => {
  const carte = new Map<string, { cartons: number; unites: number }>()
  for (const l of lignes.value) {
    if (!carte.has(l.template_nom)) carte.set(l.template_nom, { cartons: 0, unites: 0 })
    const e = carte.get(l.template_nom)!
    if (l.carton) e.cartons += l.quantite
    else e.unites += l.quantite
  }
  return [...carte.entries()]
    .map(([nom, v]) => ({ nom, ...v }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})
</script>

<template>
  <div class="resume">
    <div class="resume-entete">
      <h2>Imprimé le {{ dateAffichee }}<span v-if="estAujourdhui"> (aujourd'hui)</span></h2>
      <div class="resume-nav">
        <button type="button" class="nav-bouton" data-testid="resume-jour-precedent" @click="changerJour(-1)">
          ◀
        </button>
        <input v-model="date" type="date" :max="aujourdhui()" data-testid="resume-date" />
        <button
          type="button"
          class="nav-bouton"
          data-testid="resume-jour-suivant"
          :disabled="estAujourdhui"
          @click="changerJour(1)"
        >
          ▶
        </button>
      </div>
    </div>
    <p v-if="!chargement && !parModele.length" class="resume-vide">Rien d'imprimé ce jour-là.</p>
    <div v-else class="resume-liste">
      <div v-for="m in parModele" :key="m.nom" class="resume-ligne" :data-testid="`resume-${m.nom}`">
        <span class="resume-nom">{{ m.nom }}</span>
        <span class="resume-comptes">
          <span v-if="m.cartons" class="resume-badge resume-carton">
            {{ m.cartons }} carton{{ m.cartons > 1 ? 's' : '' }}
          </span>
          <span v-if="m.unites" class="resume-badge resume-unite">
            {{ m.unites }} étiquette{{ m.unites > 1 ? 's' : '' }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resume { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; }
.resume-entete { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.resume-entete h2 { margin: 0; font-size: 17px; color: #780000; }
.resume-nav { display: flex; align-items: center; gap: 8px; }
.nav-bouton {
  font: inherit; font-size: 18px; font-weight: 700; padding: 6px 14px; cursor: pointer;
  border: 2px solid #e5e5e5; border-radius: 8px; background: #fff; color: #555;
}
.nav-bouton:disabled { opacity: 0.4; cursor: default; }
.nav-bouton:active:not(:disabled) { border-color: #c1121f; color: #c1121f; }
.resume-nav input[type='date'] { font: inherit; font-size: 15px; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.resume-vide { color: #999; padding: 16px 0; }
.resume-liste { display: flex; flex-direction: column; gap: 8px; padding: 12px 0 24px; }
.resume-ligne {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; background: #fafafa; border-radius: 8px;
}
.resume-nom { font-weight: 700; }
.resume-comptes { display: flex; gap: 8px; flex-wrap: wrap; }
.resume-badge { font-size: 14px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
.resume-carton { background: #fdecea; color: #c1121f; }
.resume-unite { background: #eef4ff; color: #2b4c8c; }
</style>
