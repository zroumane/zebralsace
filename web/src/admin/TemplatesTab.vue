<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDialog } from 'naive-ui'
import { api, type Template } from '../api'

const router = useRouter()
const dialog = useDialog()
const templates = ref<Template[]>([])

async function charger() {
  templates.value = await api.get<Template[]>('/api/templates')
}
onMounted(charger)

// --- sections par catégorie + glisser-déposer ---
// ponytail: drag & drop HTML5 natif (usage bureau) — passer à sortablejs si
// le tactile devient un besoin réel
const categoriesVides = ref<string[]>([])
const glisse = ref<Template | null>(null)

const sections = computed(() => {
  const m = new Map<string, Template[]>()
  for (const c of categoriesVides.value) m.set(c, [])
  for (const t of templates.value) {
    if (!m.has(t.categorie)) m.set(t.categorie, [])
    m.get(t.categorie)!.push(t)
  }
  return [...m.entries()]
    .map(([categorie, liste]) => ({ categorie, liste }))
    .sort((a, b) => a.categorie.localeCompare(b.categorie)) // '' (sans catégorie) en premier
})

// dépose sur une carte = insertion avant elle ; sur la section = à la fin
async function surDrop(cible: Template | null, categorie: string) {
  const t = glisse.value
  glisse.value = null
  if (!t || (cible && cible.id === t.id)) return
  const ancienne = t.categorie

  const liste = (sections.value.find((s) => s.categorie === categorie)?.liste ?? []).filter(
    (x) => x.id !== t.id
  )
  const idx = cible ? liste.findIndex((x) => x.id === cible.id) : liste.length
  liste.splice(idx < 0 ? liste.length : idx, 0, t)

  await Promise.all(
    liste.map((x, i) =>
      x.id === t.id || x.categorie !== categorie || x.position !== i
        ? api.put(`/api/templates/${x.id}`, { categorie, position: i })
        : Promise.resolve()
    )
  )
  // réindexe l'ancienne catégorie si le modèle en a changé
  if (ancienne !== categorie) {
    const restants = templates.value.filter((x) => x.categorie === ancienne && x.id !== t.id)
    await Promise.all(
      restants.map((x, i) =>
        x.position !== i ? api.put(`/api/templates/${x.id}`, { position: i }) : Promise.resolve()
      )
    )
  }
  await charger()
}

const modalCategorie = ref(false)
const nomCategorie = ref('')
function creerCategorie() {
  const nom = nomCategorie.value.trim()
  if (nom && !sections.value.some((s) => s.categorie === nom)) categoriesVides.value.push(nom)
  modalCategorie.value = false
  nomCategorie.value = ''
}

async function creer() {
  const t = await api.post<Template>('/api/templates', { nom: 'Nouveau modèle' })
  // ?neuf=1 : l'éditeur saura que cette ébauche n'a jamais été enregistrée
  router.push(`/admin/templates/${t.id}?neuf=1`)
}

const duplication = ref<Template | null>(null)
const nomDuplication = ref('')
function ouvrirDuplication(t: Template) {
  duplication.value = t
  nomDuplication.value = `${t.nom} (copie)`
}
async function validerDuplication() {
  await api.post(`/api/templates/${duplication.value!.id}/duplicate`, { nom: nomDuplication.value })
  duplication.value = null
  await charger()
}

const renommage = ref<Template | null>(null)
const nouveauNom = ref('')
function ouvrirRenommage(t: Template) {
  renommage.value = t
  nouveauNom.value = t.nom
}
async function validerRenommage() {
  await api.put(`/api/templates/${renommage.value!.id}`, { nom: nouveauNom.value })
  renommage.value = null
  await charger()
}

function supprimer(t: Template) {
  dialog.warning({
    title: 'Supprimer le modèle',
    content: `Supprimer « ${t.nom} » ? L'historique d'impression sera conservé.`,
    positiveText: 'Supprimer',
    negativeText: 'Annuler',
    onPositiveClick: async () => {
      await api.del(`/api/templates/${t.id}`)
      await charger()
    },
  })
}
</script>

<template>
  <div>
    <div class="barre">
      <n-button type="primary" data-testid="nouveau-modele" @click="creer">+ Nouveau modèle</n-button>
      <n-button data-testid="nouvelle-categorie" @click="modalCategorie = true">+ Catégorie</n-button>
      <span class="aide">Glissez une carte sur une autre (ordre) ou sur un titre de catégorie.</span>
    </div>

    <template v-for="s in sections" :key="s.categorie">
      <h2
        class="categorie"
        :data-testid="`categorie-${s.categorie || 'sans'}`"
        @dragover.prevent
        @drop="surDrop(null, s.categorie)"
      >
        {{ s.categorie || 'Sans catégorie' }}
      </h2>
      <div class="grille" @dragover.prevent @drop.self="surDrop(null, s.categorie)">
        <div
          v-for="t in s.liste"
          :key="t.id"
          class="carte"
          draggable="true"
          :data-testid="`admin-template-${t.id}`"
          @dragstart="glisse = t"
          @dragover.prevent
          @drop.stop="surDrop(t, s.categorie)"
        >
          <img v-if="t.vignette_png" :src="t.vignette_png" :alt="t.nom" />
          <div v-else class="vide">Pas encore d'aperçu</div>
          <b>{{ t.nom }}</b>
          <small>{{ t.largeur_mm }}×{{ t.hauteur_mm }} mm — DLC {{ t.dlc_jours }} j</small>
          <div class="actions">
            <n-button size="small" @click="router.push(`/admin/templates/${t.id}`)">Modifier</n-button>
            <n-button size="small" quaternary @click="ouvrirDuplication(t)">Dupliquer</n-button>
            <n-button size="small" quaternary @click="ouvrirRenommage(t)">Renommer</n-button>
            <n-button size="small" quaternary type="error" @click="supprimer(t)">Supprimer</n-button>
          </div>
        </div>
        <p v-if="!s.liste.length" class="deposez">Déposez des modèles ici</p>
      </div>
    </template>

    <n-modal :show="modalCategorie" @update:show="modalCategorie = false">
      <n-card title="Nouvelle catégorie" style="max-width: 400px" closable @close="modalCategorie = false">
        <n-input
          v-model:value="nomCategorie"
          data-testid="champ-categorie"
          placeholder="ex. Tartes"
          @keyup.enter="creerCategorie"
        />
        <p class="note">La catégorie est conservée dès qu'un modèle y est déposé.</p>
        <template #footer>
          <n-button type="primary" data-testid="valider-categorie" @click="creerCategorie">Créer</n-button>
        </template>
      </n-card>
    </n-modal>

    <n-modal :show="!!duplication" @update:show="duplication = null">
      <n-card title="Dupliquer" style="max-width: 400px" closable @close="duplication = null">
        <n-input
          v-model:value="nomDuplication"
          data-testid="champ-duplication"
          @keyup.enter="validerDuplication"
        />
        <template #footer>
          <n-button type="primary" data-testid="valider-duplication" @click="validerDuplication">
            Valider
          </n-button>
        </template>
      </n-card>
    </n-modal>

    <n-modal :show="!!renommage" @update:show="renommage = null">
      <n-card title="Renommer" style="max-width: 400px" closable @close="renommage = null">
        <n-input v-model:value="nouveauNom" data-testid="champ-renommage" @keyup.enter="validerRenommage" />
        <template #footer>
          <n-button type="primary" data-testid="valider-renommage" @click="validerRenommage">Valider</n-button>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<style scoped>
.barre { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.aide { font-size: 12px; color: #999; }
.categorie { margin: 18px 0 0; font-size: 16px; color: #780000; border-bottom: 1px solid #eee; padding-bottom: 4px; }
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 12px 0 16px; min-height: 40px; }
.carte { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; cursor: grab; }
.deposez { color: #bbb; font-size: 13px; margin: 0; align-self: center; }
.note { font-size: 12px; color: #666; margin: 8px 0 0; }
.carte img { width: 100%; border: 1px solid #eee; }
.vide { aspect-ratio: 2; display: grid; place-items: center; color: #999; background: #f7f7f7; }
small { color: #666; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
</style>
