<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDialog } from 'naive-ui'
import { api, type Template } from '../api'

const router = useRouter()
const dialog = useDialog()
const templates = ref<Template[]>([])

interface Categorie { id: number; nom: string; position: number }
const categories = ref<Categorie[]>([])

async function charger() {
  ;[templates.value, categories.value] = await Promise.all([
    api.get<Template[]>('/api/templates'),
    api.get<Categorie[]>('/api/categories'),
  ])
}
onMounted(charger)

// --- sections par catégorie + glisser-déposer ---
// ponytail: drag & drop HTML5 natif (usage bureau) — passer à sortablejs si
// le tactile devient un besoin réel
const glisse = ref<Template | null>(null)

// sans catégorie d'abord, puis l'ordre de la table categories (id = 0 : section
// non gérable — sans catégorie ou catégorie orpheline absente de la table)
const sections = computed(() => {
  const par = new Map<string, Template[]>()
  for (const t of templates.value) {
    if (!par.has(t.categorie)) par.set(t.categorie, [])
    par.get(t.categorie)!.push(t)
  }
  const out: { categorie: string; id: number; liste: Template[] }[] = []
  if (par.has('')) out.push({ categorie: '', id: 0, liste: par.get('')! })
  for (const c of categories.value) out.push({ categorie: c.nom, id: c.id, liste: par.get(c.nom) ?? [] })
  for (const [nom, liste] of par)
    if (nom && !categories.value.some((c) => c.nom === nom)) out.push({ categorie: nom, id: 0, liste })
  return out
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

  await api.post('/api/templates/ordre', { categorie, ids: liste.map((x) => x.id) })
  // réindexe l'ancienne catégorie si le modèle en a changé
  if (ancienne !== categorie) {
    const restants = templates.value.filter((x) => x.categorie === ancienne && x.id !== t.id)
    await api.post('/api/templates/ordre', { categorie: ancienne, ids: restants.map((x) => x.id) })
  }
  await charger()
}

// ordre des catégories : flèches ↑/↓ sur les titres
async function deplacerCategorie(id: number, delta: number) {
  const ids = categories.value.map((c) => c.id)
  const i = ids.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await api.post('/api/categories/ordre', { ids })
  await charger()
}

const catRenommage = ref<{ id: number; categorie: string } | null>(null)
const catNouveauNom = ref('')
function ouvrirRenommageCat(s: { id: number; categorie: string }) {
  catRenommage.value = s
  catNouveauNom.value = s.categorie
}
async function validerRenommageCat() {
  const c = catRenommage.value
  const nom = catNouveauNom.value.trim()
  catRenommage.value = null
  if (!c || !nom || nom === c.categorie) return
  await api.put(`/api/categories/${c.id}`, { nom })
  await charger()
}

async function supprimerCategorie(s: { id: number; categorie: string }) {
  const ok = window.confirm(
    `Supprimer la catégorie « ${s.categorie} » ? Ses modèles passeront dans « Sans catégorie ».`
  )
  if (!ok) return
  await api.del(`/api/categories/${s.id}`)
  await charger()
}

const modalCategorie = ref(false)
const nomCategorie = ref('')
async function creerCategorie() {
  const nom = nomCategorie.value.trim()
  modalCategorie.value = false
  nomCategorie.value = ''
  if (!nom) return
  await api.post('/api/categories', { nom })
  await charger()
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
        <span v-if="s.id" class="fleches">
          <n-button size="tiny" quaternary :data-testid="`cat-monter-${s.categorie}`" title="Monter" @click="deplacerCategorie(s.id, -1)">↑</n-button>
          <n-button size="tiny" quaternary :data-testid="`cat-descendre-${s.categorie}`" title="Descendre" @click="deplacerCategorie(s.id, 1)">↓</n-button>
          <n-button size="tiny" quaternary :data-testid="`cat-renommer-${s.categorie}`" @click="ouvrirRenommageCat(s)">Renommer</n-button>
          <n-button size="tiny" quaternary type="error" :data-testid="`cat-supprimer-${s.categorie}`" @click="supprimerCategorie(s)">Supprimer</n-button>
        </span>
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
          @click="router.push(`/admin/templates/${t.id}`)"
        >
          <div class="apercu">
            <img v-if="t.vignette_png" :src="t.vignette_png" :alt="t.nom" />
            <span v-else class="vide">Pas encore d'aperçu</span>
          </div>
          <b>{{ t.nom }}</b>
          <small>{{ t.largeur_mm }} × {{ t.hauteur_mm }} mm</small>
          <div class="actions" @click.stop>
            <n-button size="small" @click="router.push(`/admin/templates/${t.id}`)">Modifier</n-button>
            <n-button size="small" quaternary @click="ouvrirDuplication(t)">Dupliquer</n-button>
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

    <n-modal :show="!!catRenommage" @update:show="catRenommage = null">
      <n-card title="Renommer la catégorie" style="max-width: 400px" closable @close="catRenommage = null">
        <n-input
          v-model:value="catNouveauNom"
          placeholder=""
          data-testid="champ-renommage-categorie"
          @keyup.enter="validerRenommageCat"
        />
        <template #footer>
          <n-button type="primary" data-testid="valider-renommage-categorie" @click="validerRenommageCat">Renommer</n-button>
        </template>
      </n-card>
    </n-modal>

    <n-modal :show="!!duplication" @update:show="duplication = null">
      <n-card title="Dupliquer" style="max-width: 400px" closable @close="duplication = null">
        <n-input
          v-model:value="nomDuplication"
          placeholder=""
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

  </div>
</template>

<style scoped>
.barre { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.aide { font-size: 12px; color: #999; }
.categorie { margin: 18px 0 0; font-size: 16px; color: #780000; border-bottom: 1px solid #eee; padding-bottom: 4px; display: flex; align-items: center; gap: 10px; }
.fleches { display: flex; gap: 2px; }
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 12px 0 16px; min-height: 40px; }
.carte {
  border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px;
  display: flex; flex-direction: column; gap: 6px; cursor: grab;
  height: 250px; /* toutes les cartes à la même taille */
}
.deposez { color: #bbb; font-size: 13px; margin: 0; align-self: center; }
.note { font-size: 12px; color: #666; margin: 8px 0 0; }
.apercu {
  flex: 1; min-height: 0; display: grid; place-items: center;
  background: #fafafa; border: 1px solid #eee; border-radius: 4px; overflow: hidden;
}
.apercu img { max-width: 100%; max-height: 100%; object-fit: contain; }
.vide { color: #999; font-size: 13px; }
small { color: #666; }
/* toujours sur une seule ligne */
.actions { display: flex; flex-wrap: nowrap; gap: 6px; margin-top: 4px; }
.actions :deep(.n-button) { padding: 0 10px; }
</style>
