<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type LigneJournal } from '../api'

const lignes = ref<LigneJournal[]>([])
onMounted(async () => {
  lignes.value = await api.get<LigneJournal[]>('/api/print-log?statut=erreur')
})
</script>

<template>
  <n-data-table
    :columns="[
      { title: 'Date et heure', key: 'date_heure' },
      { title: 'Modèle', key: 'template_nom' },
      { title: 'Quantité', key: 'quantite' },
      { title: 'Motif', key: 'erreur_message' },
    ]"
    :data="lignes"
    :bordered="false"
    data-testid="table-erreurs"
  />
</template>
