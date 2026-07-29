<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { api, type Logo } from '../api'
import { optimizeImage } from '../imageOpt'
import { mmToPx } from '../render'

defineProps<{ mode: 'pick' | 'manage' }>()
const emit = defineEmits<{ pick: [logo: Logo] }>()
const message = useMessage()

const logos = ref<Logo[]>([])
const type = ref<'logo' | 'code-barres'>('logo')

// résolution et laize configurées : un logo optimisé trop petit imprimerait flou
const dpi = ref(300)
const laize = ref(104)
api.get<Record<string, string>>('/api/settings').then((s) => {
  dpi.value = Number(s.dpi)
  laize.value = Number(s.laize_mm ?? 104)
})

async function charger() {
  logos.value = await api.get<Logo[]>('/api/logos')
}
onMounted(charger)

async function surFichier(e: Event) {
  const cible = e.target as HTMLInputElement
  const fichier = cible.files?.[0]
  if (!fichier) return
  // laize configurée dans les réglages ; un code-barres n'est jamais redimensionné
  const png = await optimizeImage(fichier, {
    maxWidthPx: mmToPx(laize.value, dpi.value),
    resize: type.value !== 'code-barres',
  })
  await api.post('/api/logos', { nom: fichier.name.replace(/\.\w+$/, ''), type: type.value, png })
  cible.value = ''
  await charger()
  message.success('Image optimisée et ajoutée à la bibliothèque')
}

async function supprimer(l: Logo) {
  await api.del(`/api/logos/${l.id}`)
  await charger()
}
</script>

<template>
  <div class="biblio">
    <n-radio-group v-model:value="type" size="small">
      <n-radio-button value="logo">Logo</n-radio-button>
      <n-radio-button value="code-barres">Code-barres</n-radio-button>
    </n-radio-group>
    <input type="file" accept="image/png,image/jpeg" data-testid="upload-image" @change="surFichier" />
    <div class="vignettes">
      <figure v-for="l in logos" :key="l.id" :data-testid="`logo-${l.id}`">
        <img :src="`/logos/${l.chemin_fichier}`" :alt="l.nom" @click="mode === 'pick' && emit('pick', l)" />
        <figcaption>
          {{ l.nom }}<em v-if="l.type === 'code-barres'"> (code-barres)</em>
          <n-button v-if="mode === 'manage'" size="tiny" quaternary type="error" @click="supprimer(l)">
            Supprimer
          </n-button>
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.biblio { display: flex; flex-direction: column; gap: 8px; }
.vignettes { display: flex; flex-direction: column; gap: 8px; max-height: 40vh; overflow: auto; }
figure { margin: 0; }
figure img { max-width: 100%; border: 1px solid #e5e5e5; cursor: pointer; background: #fff; }
figcaption { font-size: 12px; color: #666; }
</style>
