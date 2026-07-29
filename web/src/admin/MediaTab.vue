<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { api, type Logo } from '../api'
import { optimizeImage } from '../imageOpt'
import { mmToPx } from '../render'

const message = useMessage()
const logos = ref<Logo[]>([])
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

// --- import d'une image ---
const nomImage = ref('')
const envoiEnCours = ref(false)

async function surFichier(e: Event) {
  const cible = e.target as HTMLInputElement
  const fichier = cible.files?.[0]
  if (!fichier) return
  envoiEnCours.value = true
  try {
    const png = await optimizeImage(fichier, {
      maxWidthPx: mmToPx(laize.value, dpi.value),
      resize: true,
    })
    const nom = nomImage.value.trim() || fichier.name.replace(/\.\w+$/, '')
    await api.post('/api/logos', { nom, type: 'logo', png })
    nomImage.value = ''
    await charger()
    message.success(`« ${nom} » ajouté à la bibliothèque`)
  } catch (err) {
    message.error(`Import impossible : ${(err as Error).message}`)
  } finally {
    envoiEnCours.value = false
    cible.value = ''
  }
}

async function renommer(l: Logo) {
  const nom = window.prompt('Nouveau nom :', l.nom)?.trim()
  if (!nom || nom === l.nom) return
  await api.put(`/api/logos/${l.id}`, { nom })
  await charger()
  message.success(`Renommé en « ${nom} »`)
}

// --- génération de code-barres (bwip-js, 100 % locale) ---
const cbNom = ref('')
const cbType = ref('ean13')
const cbValeur = ref('')

async function genererCodeBarres() {
  const nom = cbNom.value.trim()
  if (!nom) {
    message.error('Donnez un nom au code-barres')
    return
  }
  try {
    const { default: bwipjs } = await import('bwip-js')
    const c = document.createElement('canvas')
    const opts: Record<string, unknown> = {
      bcid: cbType.value,
      text: cbValeur.value.trim(),
      scale: Math.max(2, Math.round(dpi.value / 100)),
    }
    if (cbType.value !== 'qrcode') {
      opts.height = 12
      opts.includetext = true
      opts.textxalign = 'center'
    }
    bwipjs.toCanvas(c, opts as never)
    await api.post('/api/logos', { nom, type: 'code-barres', png: c.toDataURL('image/png') })
    cbNom.value = ''
    cbValeur.value = ''
    await charger()
    message.success(`« ${nom} » ajouté à la bibliothèque`)
  } catch (e) {
    message.error(`Code-barres invalide : ${String((e as Error).message ?? e)}`)
  }
}

async function supprimer(l: Logo) {
  await api.del(`/api/logos/${l.id}`)
  await charger()
}
</script>

<template>
  <div class="medias">
    <section>
      <h2>Importer une image</h2>
      <label>Nom <n-input v-model:value="nomImage" data-testid="media-nom" placeholder="par défaut : nom du fichier" /></label>
      <input type="file" accept="image/png,image/jpeg" data-testid="upload-image" :disabled="envoiEnCours" @change="surFichier" />
      <p v-if="envoiEnCours" class="note encours"><n-spin size="small" /> Optimisation et envoi en cours…</p>
      <p v-else class="note">Optimisée à l'import (noir et blanc, résolution configurée).</p>
    </section>

    <section>
      <h2>Générer un code-barres</h2>
      <label>Nom <n-input v-model:value="cbNom" data-testid="cb-nom" placeholder="ex. EAN Quiche 500 g" /></label>
      <n-select
        v-model:value="cbType"
        :options="[
          { label: 'EAN-13 (produit)', value: 'ean13' },
          { label: 'Code 128 (alphanumérique)', value: 'code128' },
          { label: 'QR Code', value: 'qrcode' },
        ]"
      />
      <n-input
        v-model:value="cbValeur"
        data-testid="cb-valeur"
        placeholder="Valeur (12 chiffres pour un EAN-13)"
        @keyup.enter="genererCodeBarres"
      />
      <n-button type="primary" data-testid="cb-generer" @click="genererCodeBarres">Générer</n-button>
      <p class="note">Génération 100 % locale, aucun service externe.</p>
    </section>

    <section class="biblio">
      <h2>Bibliothèque</h2>
      <p class="note">Disponible dans l'éditeur de tous les modèles.</p>
      <div class="vignettes">
        <figure v-for="l in logos" :key="l.id" :data-testid="`media-${l.id}`">
          <img :src="`/logos/${l.chemin_fichier}`" :alt="l.nom" />
          <figcaption>
            <b>{{ l.nom }}</b><em v-if="l.type === 'code-barres'"> (code-barres)</em>
            <n-button size="tiny" quaternary :data-testid="`renommer-${l.id}`" @click="renommer(l)">Renommer</n-button>
            <n-button size="tiny" quaternary type="error" @click="supprimer(l)">Supprimer</n-button>
          </figcaption>
        </figure>
        <p v-if="!logos.length" class="note">
          Aucun média — importez une image ou générez un code-barres.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.medias { display: flex; flex-wrap: wrap; gap: 48px; padding: 16px 0; align-items: flex-start; }
section { width: 340px; display: flex; flex-direction: column; gap: 10px; }
section.biblio { flex: 1; min-width: 340px; }
h2 { font-size: 16px; color: #780000; margin: 0; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; }
.note { font-size: 12px; color: #666; margin: 0; }
.encours { display: flex; align-items: center; gap: 8px; color: #9a5b00; }
.vignettes { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
figure { margin: 0; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px; }
figure img { max-width: 100%; max-height: 90px; object-fit: contain; background: #fff; display: block; margin: 0 auto; }
figcaption { font-size: 13px; color: #444; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
</style>
