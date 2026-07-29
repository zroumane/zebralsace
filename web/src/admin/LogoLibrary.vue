<script setup lang="ts">
// Sélecteur de médias pour l'éditeur : liste la bibliothèque partagée
// (titre + aperçu). La création et la gestion se font dans l'onglet Médias.
import { onMounted, ref } from 'vue'
import { api, type Logo } from '../api'

const emit = defineEmits<{ pick: [logo: Logo] }>()

const logos = ref<Logo[]>([])
onMounted(async () => {
  logos.value = await api.get<Logo[]>('/api/logos')
})
</script>

<template>
  <div class="choix">
    <button
      v-for="l in logos"
      :key="l.id"
      class="media"
      :data-testid="`logo-${l.id}`"
      :title="l.nom"
      @click="emit('pick', l)"
    >
      <img :src="`/logos/${l.chemin_fichier}`" :alt="l.nom" />
      <span>{{ l.nom }}<em v-if="l.type === 'code-barres'"> (CB)</em></span>
    </button>
    <p v-if="!logos.length" class="vide">
      Aucun média — créez-les dans Administration → Médias.
    </p>
  </div>
</template>

<style scoped>
.choix { display: flex; flex-direction: column; gap: 6px; max-height: 45vh; overflow: auto; }
.media {
  display: flex; align-items: center; gap: 8px; padding: 4px 6px;
  background: #fff; border: 1px solid #e5e5e5; border-radius: 6px;
  cursor: pointer; font: inherit; text-align: left;
}
.media:hover { border-color: #c1121f; }
.media img { width: 42px; height: 32px; object-fit: contain; flex: none; background: #fff; }
.media span { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vide { font-size: 12px; color: #999; margin: 0; }
</style>
