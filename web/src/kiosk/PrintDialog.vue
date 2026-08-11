<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useMessage } from 'naive-ui'
import { api, type Globale, type Template } from '../api'
import { addDays, computeVars } from '../vars'
import { renderLabel } from '../render'
import { useStatus } from '../useStatus'

const props = defineProps<{ template: Template }>()
const emit = defineEmits<{ close: [] }>()
const message = useMessage()
const statut = useStatus()

// affichage instantané avec les props, puis rafraîchi : le kiosque reste ouvert des jours
// durant, un modèle corrigé au bureau (ex. allergène) doit être repris avant impression.
const template = ref<Template>(props.template)

// jamais toISOString ici : à minuit passé, l'UTC donnerait la veille
const versIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fabrication = ref(versIso(new Date()))
const peremption = ref(versIso(addDays(new Date(), template.value.dlc_jours)))
const peremptionTouchee = ref(false)
watch(fabrication, (v) => {
  if (!peremptionTouchee.value)
    peremption.value = versIso(addDays(new Date(v), template.value.dlc_jours))
})

api.get<Template>(`/api/templates/${props.template.id}`).then((t) => {
  template.value = t
  if (!peremptionTouchee.value)
    peremption.value = versIso(addDays(new Date(fabrication.value), t.dlc_jours))
})

// cochée = la date figure sur l'étiquette et son champ est modifiable
const avecDate = ref(true)
const avecDlc = ref(true)
const quantite = ref(1)

function ajouterQuantite(n: number) {
  quantite.value = Math.min(99999999, Math.max(1, quantite.value + n))
}
const apercu = ref('')
const impressionEnCours = ref(false)
const globales = ref<Globale[]>([])
api.get<Globale[]>('/api/globals').then((g) => (globales.value = g))

const dpi = ref(300)
api.get<Record<string, string>>('/api/settings').then((s) => (dpi.value = Number(s.dpi)))

// jeton + compteur : évite qu'un rendu périmé (globales/dpi qui arrivent après une date déjà
// changée) n'écrase apercu après un rendu plus récent. rendusEnCours reste une variable simple
// (non réactive) : la lire dans ce même watchEffect via `.value++` la ferait tracker comme
// dépendance et le `.value = ...` suivant re-déclencherait cet effet à l'infini (boucle
// synchrone qui gèle l'onglet). enCours n'est donc jamais lu ici, seulement écrit.
let rendu = 0
let rendusEnCours = 0
const enCours = ref(false)
watchEffect(async () => {
  const jeton = ++rendu
  rendusEnCours++
  enCours.value = true
  try {
    const png = await renderLabel(JSON.parse(template.value.doc_json), {
      widthMm: template.value.largeur_mm,
      heightMm: template.value.hauteur_mm,
      dpi: dpi.value,
      vars: computeVars(globales.value, new Date(fabrication.value), new Date(peremption.value)),
      baseDate: new Date(fabrication.value),
      hideDlc: !avecDlc.value,
      hideDate: !avecDate.value,
    })
    if (jeton === rendu) apercu.value = png
  } catch (e) {
    if (jeton === rendu) {
      apercu.value = ''
      message.error("Impossible d'afficher l'aperçu : " + (e as Error).message)
    }
  } finally {
    rendusEnCours--
    enCours.value = rendusEnCours > 0
  }
})

const peutImprimer = computed(
  () => statut.value.pret && !impressionEnCours.value && !enCours.value && !!apercu.value
)

async function imprimer() {
  impressionEnCours.value = true
  try {
    await api.post('/api/print', {
      template_nom: template.value.nom,
      quantite: quantite.value,
      png: apercu.value,
    })
    message.success(
      `${quantite.value} étiquette${quantite.value > 1 ? 's' : ''} ajoutée${quantite.value > 1 ? 's' : ''} à la file d'impression`
    )
    emit('close')
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    impressionEnCours.value = false
  }
}
</script>

<template>
  <n-modal :show="true" @update:show="emit('close')">
    <n-card class="plein-ecran" :content-style="{ display: 'flex', overflow: 'auto' }">
      <template #header>
        {{ template.nom }}
        <span class="dims">{{ template.largeur_mm }} × {{ template.hauteur_mm }} mm</span>
      </template>
      <template #header-extra>
        <button class="fermer" data-testid="fermer-impression" title="Fermer" @click="emit('close')">✕</button>
      </template>
      <div class="contenu">
        <div class="zone-apercu">
          <img class="apercu" :src="apercu" alt="aperçu de l'étiquette" data-testid="apercu" />
        </div>
        <div class="reglages">
          <div class="dates">
            <div class="date-choix" :class="{ inactif: !avecDate }">
              <n-checkbox v-model:checked="avecDate" data-testid="avec-date">Date de fabrication</n-checkbox>
              <input v-model="fabrication" type="date" :disabled="!avecDate" data-testid="date-fabrication" />
            </div>
            <div class="date-choix" :class="{ inactif: !avecDlc }">
              <n-checkbox v-model:checked="avecDlc" data-testid="avec-dlc">Date de péremption</n-checkbox>
              <input
                v-model="peremption"
                type="date"
                :disabled="!avecDlc"
                data-testid="date-peremption"
                @input="peremptionTouchee = true"
              />
            </div>
          </div>

          <div class="quantite">
            <n-button secondary :disabled="quantite <= 1" @click="ajouterQuantite(-10)">−10</n-button>
            <n-button secondary :disabled="quantite <= 1" @click="ajouterQuantite(-5)">−5</n-button>
            <n-button secondary :disabled="quantite <= 1" @click="ajouterQuantite(-1)">−</n-button>
            <n-input-number
              v-model:value="quantite"
              :min="1"
              :max="99999999"
              :show-button="false"
              data-testid="quantite"
            />
            <n-button secondary @click="ajouterQuantite(1)">+</n-button>
            <n-button secondary @click="ajouterQuantite(5)">+5</n-button>
            <n-button secondary @click="ajouterQuantite(10)">+10</n-button>
          </div>

          <n-button
            type="primary"
            size="large"
            block
            class="btn-imprimer"
            :disabled="!peutImprimer"
            data-testid="imprimer"
            @click="imprimer"
          >
            IMPRIMER
          </n-button>
          <p v-if="!statut.pret" class="bloque">{{ statut.message }}</p>
        </div>
      </div>
    </n-card>
  </n-modal>
</template>

<style scoped>
/* le popup occupe tout l'écran (kiosque tactile) — 100dvh, pas 100vh : sur
   iPad/Safari, 100vh compte la barre d'adresse et fait déborder la popup
   sous le bas visible de l'écran. dvh suit la hauteur réellement visible. */
.plein-ecran { width: 100vw; height: 100vh; height: 100dvh; max-width: none; border-radius: 0; }
.fermer {
  font-size: 64px; line-height: 1; padding: 10px 20px; background: none; border: none;
  cursor: pointer; color: #333;
}
.fermer:active { color: #c1121f; }
.dims { font-size: 17px; font-weight: 400; color: #888; margin-left: 10px; }
.contenu { display: flex; gap: 32px; flex: 1; min-height: 0; }
/* max-width/max-height seuls ne font qu'empêcher l'image de déborder, ils ne la
   font pas grandir : sans width/height 100% + object-fit, l'aperçu restait à sa
   taille native (petite) au lieu de remplir l'espace disponible. */
.zone-apercu { flex: 1; min-width: 0; min-height: 0; display: flex; padding: 12px; box-sizing: border-box; }
.apercu { width: 100%; height: 100%; object-fit: contain; border: 1px solid #e5e5e5; box-sizing: border-box; }
/* tablette : cibles tactiles généreuses, tout en grand */
.reglages { width: 680px; display: flex; flex-direction: column; gap: 32px; min-height: 0; overflow-y: auto; }
/* les deux dates côte à côte, IMPRIMER calé en bas de la colonne */
.dates { display: flex; gap: 20px; }
.dates .date-choix { flex: 1; }
.btn-imprimer { margin-top: auto; --n-height: 140px !important; font-size: 42px; letter-spacing: 1px; }
.date-choix { display: flex; flex-direction: column; gap: 10px; }
.date-choix :deep(.n-checkbox) { --n-size: 42px !important; --n-font-size: 26px !important; align-items: center; }
.date-choix :deep(.n-checkbox__label) { font-weight: 700; }
.date-choix input { font-size: 32px; padding: 22px 16px; border: 1px solid #ccc; border-radius: 8px; width: 100%; box-sizing: border-box; }
.inactif input { opacity: 0.45; }
/* − à gauche, + à droite, le nombre en gros au centre */
.quantite { display: flex; gap: 12px; align-items: stretch; }
.quantite :deep(.n-button) { --n-height: 120px !important; height: 120px; font-size: 32px; padding: 0 18px; }
.quantite :deep(.n-input-number) { flex: 1; min-width: 140px; }
.quantite :deep(.n-input-number .n-input) { --n-height: 120px !important; --n-font-size: 56px !important; }
.quantite :deep(.n-input-number input) { text-align: center; font-weight: 700; }
.bloque { font-size: 20px; }
.bloque { color: #780000; font-weight: 700; margin: 0; }
</style>
