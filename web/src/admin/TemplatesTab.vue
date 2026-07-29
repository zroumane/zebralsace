<script setup lang="ts">
import { onMounted, ref } from 'vue'
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

async function creer() {
  const t = await api.post<Template>('/api/templates', { nom: 'Nouveau modèle' })
  router.push(`/admin/templates/${t.id}`)
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
    <n-button type="primary" data-testid="nouveau-modele" @click="creer">+ Nouveau modèle</n-button>
    <div class="grille">
      <div v-for="t in templates" :key="t.id" class="carte" :data-testid="`admin-template-${t.id}`">
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
    </div>

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
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 16px 0; }
.carte { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.carte img { width: 100%; border: 1px solid #eee; }
.vide { aspect-ratio: 2; display: grid; place-items: center; color: #999; background: #f7f7f7; }
small { color: #666; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
</style>
