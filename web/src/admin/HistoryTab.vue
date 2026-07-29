<script setup lang="ts">
import { h, onMounted, ref, watch } from 'vue'
import { NTag } from 'naive-ui'
import { api, type LigneJournal } from '../api'

const lignes = ref<LigneJournal[]>([])
const plage = ref<[number, number] | null>(null)

const isoLocale = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function charger() {
  const filtre = plage.value ? `?from=${isoLocale(plage.value[0])}&to=${isoLocale(plage.value[1])}` : ''
  lignes.value = await api.get<LigneJournal[]>(`/api/print-log${filtre}`)
}
onMounted(charger)
watch(plage, charger)

const colonnes = [
  { title: 'Date et heure', key: 'date_heure' },
  { title: 'Modèle', key: 'template_nom' },
  { title: 'Quantité', key: 'quantite' },
  {
    title: 'Statut',
    key: 'statut',
    render: (l: LigneJournal) =>
      h(NTag, { type: l.statut === 'ok' ? 'success' : 'error', size: 'small' }, () => l.statut),
  },
]
</script>

<template>
  <div>
    <n-date-picker v-model:value="plage" type="daterange" clearable start-placeholder="Du" end-placeholder="Au" />
    <n-data-table :columns="colonnes" :data="lignes" :bordered="false" data-testid="table-historique" />
  </div>
</template>
