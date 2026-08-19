<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { api, type Template } from '../api'
import { useStatus } from '../useStatus'
import StatusBadge from './StatusBadge.vue'
import PrintDialog from './PrintDialog.vue'
import ResumeImpressions from './ResumeImpressions.vue'

const statut = useStatus()
const message = useMessage()
const route = useRoute()
const router = useRouter()

// pas de file affichée au kiosque : un simple flash message quand un job
// aboutit ou échoue (le premier relevé ne notifie pas ce qui date d'avant)
const etatsVus = new Map<number, string>()
let premierReleve = true
watch(
  () => statut.value.file,
  (file) => {
    for (const j of file ?? []) {
      const avant = etatsVus.get(j.id)
      etatsVus.set(j.id, j.etat)
      if (premierReleve || avant === j.etat) continue
      if (j.etat === 'ok')
        message.success(`${j.template_nom} × ${j.quantite} : imprimée${j.quantite > 1 ? 's' : ''}`)
      if (j.etat === 'erreur')
        message.error(`${j.template_nom} : ${j.erreur_message ?? 'erreur'}`, { duration: 8000 })
    }
    premierReleve = false
  }
)

const templates = ref<Template[]>([])
// le modèle ouvert vient de l'URL (/etiquette/:id), pas d'un état local : ainsi
// le bouton retour du navigateur/iPad referme la popup et retombe sur le kiosque
const templateChoisi = computed(
  () => templates.value.find((t) => String(t.id) === route.params.id) ?? null
)

async function charger() {
  templates.value = await api.get<Template[]>('/api/templates')
}
onMounted(charger)

function ouvrir(t: Template) {
  router.push(`/etiquette/${t.id}`)
}
function fermer() {
  router.back()
  charger()
}

// sections par catégorie — l'ordre (catégories alphabétiques, puis position
// définie dans l'éditeur) vient du serveur, on ne fait que regrouper
const sections = computed(() => {
  const parCategorie = new Map<string, Template[]>()
  for (const t of templates.value) {
    if (!parCategorie.has(t.categorie)) parCategorie.set(t.categorie, [])
    parCategorie.get(t.categorie)!.push(t)
  }
  return [...parCategorie.entries()].map(([categorie, liste]) => ({ categorie, liste }))
})
</script>

<template>
  <div class="kiosque">
    <header class="entete">
      <h1>Étiquettes</h1>
      <StatusBadge />
      <router-link class="lien-admin" to="/admin/modeles">Administration</router-link>
    </header>

    <div class="corps">
      <template v-for="s in sections" :key="s.categorie">
        <h2 v-if="s.categorie" class="section">{{ s.categorie }}</h2>
        <div class="grille">
          <button
            v-for="t in s.liste"
            :key="t.id"
            class="carte"
            :data-testid="`template-${t.id}`"
            @click="ouvrir(t)"
          >
            <span>{{ t.nom }}</span>
          </button>
        </div>
      </template>
      <p v-if="!templates.length" class="aucun">
        Aucun modèle d'étiquette. Créez-en un depuis l'administration.
      </p>
      <ResumeImpressions />
    </div>

    <PrintDialog
      v-if="templateChoisi"
      :template="templateChoisi"
      @close="fermer"
    />
  </div>
</template>

<style scoped>
/* toujours calé exactement sur l'écran visible (pas 100vh : sur iPad/Safari ça
   déborde sous la barre d'adresse) — seul .corps défile, la page elle-même jamais */
.kiosque {
  position: fixed; inset: 0;
  padding: 16px 24px;
  box-sizing: border-box;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.entete { flex: none; }
.corps { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.lien-admin { color: #999; font-size: 14px; text-decoration: none; }
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; padding: 16px 0 24px; }
.section { margin: 18px 0 0; font-size: 17px; color: #780000; border-bottom: 1px solid #eee; padding-bottom: 4px; }
.aucun { color: #999; text-align: center; padding: 48px 0; font-size: 17px; }
.carte {
  background: #fff; border: 2px solid #e5e5e5; border-radius: 12px;
  min-height: 140px; padding: 16px; cursor: pointer; font: inherit;
  display: grid; place-items: center;
}
.carte:active { border-color: #c1121f; background: #fdecea; }
.carte span { font-weight: 700; font-size: 26px; text-align: center; }
</style>
