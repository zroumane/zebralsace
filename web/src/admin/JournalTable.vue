<script setup lang="ts">
// Table partagée par les onglets Historique (impressions réussies) et Erreurs
// (échouées) — mêmes filtres, mêmes colonnes Date/Heure, même export Excel et
// la même pagination ; seul le statut interrogé change, et Erreurs ajoute la
// colonne Motif.
import { computed, onMounted, ref, watch } from 'vue'
import { api, type LigneJournal } from '../api'

const props = defineProps<{
  statut: 'ok' | 'erreur'
  avecMotif?: boolean
  testIdTable: string
  nomExport: string
}>()

const lignes = ref<LigneJournal[]>([])
const plage = ref<[number, number] | null>(null)
const modeles = ref<string[]>([])
const modele = ref<string | null>(null)

const isoLocale = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// date_heure vient de SQLite au format "AAAA-MM-JJ HH:MM:SS" (heure locale) :
// on la scinde en deux colonnes affichées en JJ/MM/AAAA et HH:MM (24 h).
function dateAffichee(dateHeure: string): string {
  const [aaaa, mm, jj] = dateHeure.split(' ')[0].split('-')
  return `${jj}/${mm}/${aaaa}`
}
function heureAffichee(dateHeure: string): string {
  return dateHeure.split(' ')[1]?.slice(0, 5) ?? ''
}

async function charger() {
  const params = new URLSearchParams({ statut: props.statut })
  if (plage.value) {
    params.set('from', isoLocale(plage.value[0]))
    params.set('to', isoLocale(plage.value[1]))
  }
  if (modele.value) params.set('template_nom', modele.value)
  lignes.value = await api.get<LigneJournal[]>(`/api/print-log?${params}`)
}
onMounted(async () => {
  modeles.value = await api.get<string[]>('/api/print-log/modeles')
  await charger()
})
watch([plage, modele], charger)

const colonnes = computed(() => [
  { title: 'Date', key: 'date', render: (l: LigneJournal) => dateAffichee(l.date_heure) },
  { title: 'Heure', key: 'heure', render: (l: LigneJournal) => heureAffichee(l.date_heure) },
  { title: 'Modèle', key: 'template_nom' },
  { title: 'Quantité', key: 'quantite' },
  ...(props.avecMotif ? [{ title: 'Motif', key: 'erreur_message' }] : []),
])

// export Excel (CSV) de ce qui est affiché — donc déjà filtré par date/modèle.
// « ; » comme séparateur et un BOM UTF-8 : Excel en locale française détecte
// les colonnes et les accents correctement à l'ouverture, sans réglage manuel.
function echapperCsv(v: unknown): string {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function exporterExcel() {
  const entetes = ['Date', 'Heure', 'Modèle', 'Quantité', ...(props.avecMotif ? ['Motif'] : [])]
  const corps = lignes.value.map((l) =>
    [
      dateAffichee(l.date_heure),
      heureAffichee(l.date_heure),
      l.template_nom,
      l.quantite,
      ...(props.avecMotif ? [l.erreur_message ?? ''] : []),
    ]
      .map(echapperCsv)
      .join(';')
  )
  const BOM_UTF8 = '﻿'
  const csv = BOM_UTF8 + [entetes.join(';'), ...corps].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.nomExport}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div>
    <div class="filtres">
      <n-date-picker v-model:value="plage" type="daterange" clearable start-placeholder="Du" end-placeholder="Au" />
      <n-select
        v-model:value="modele"
        :options="modeles.map((m) => ({ label: m, value: m }))"
        clearable
        filterable
        placeholder="Tous les modèles"
        data-testid="filtre-modele"
        style="width: 260px"
      />
      <n-button secondary data-testid="exporter-excel" :disabled="!lignes.length" @click="exporterExcel">
        Exporter (Excel)
      </n-button>
    </div>
    <n-data-table
      :columns="colonnes"
      :data="lignes"
      :bordered="false"
      :pagination="{ pageSize: 20 }"
      :data-testid="testIdTable"
    />
  </div>
</template>

<style scoped>
.filtres { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
</style>
