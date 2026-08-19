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

// étiquette carton : la quantité affichée dessus ({{quantite}}) n'est pas
// modifiable au moment de l'impression — figée sur celle réglée dans le
// modèle (Administration → modèle → Quantité carton). Le nombre d'étiquettes
// À IMPRIMER, lui, reste choisissable comme en mode Lot (ex. plusieurs
// cartons identiques à étiqueter d'un coup) — 1 par défaut.
const modeCarton = ref(false)
const quantiteCarton = ref(1)
function ajouterQuantiteCarton(n: number) {
  quantiteCarton.value = Math.min(99999999, Math.max(1, quantiteCarton.value + n))
}

// Lot d'étiquettes : la quantité par défaut reprend celle du modèle (un
// carton d'un coup, le cas le plus courant), modifiable ensuite au cas par
// cas comme la DLC.
const quantite = ref(template.value.quantite_carton)
const quantiteTouchee = ref(false)

api.get<Template>(`/api/templates/${props.template.id}`).then((t) => {
  template.value = t
  if (!peremptionTouchee.value)
    peremption.value = versIso(addDays(new Date(fabrication.value), t.dlc_jours))
  if (!quantiteTouchee.value) quantite.value = t.quantite_carton
})

// cochée = la date figure sur l'étiquette et son champ est modifiable
const avecDate = ref(true)
const avecDlc = ref(true)

function ajouterQuantite(n: number) {
  quantite.value = Math.min(99999999, Math.max(1, quantite.value + n))
  quantiteTouchee.value = true
}
const quantiteFinale = computed(() => (modeCarton.value ? quantiteCarton.value : quantite.value))
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
      vars: computeVars(
        globales.value,
        new Date(fabrication.value),
        new Date(peremption.value),
        template.value.quantite_carton,
        template.value.poids_g,
        modeCarton.value
      ),
      baseDate: new Date(fabrication.value),
      hideDlc: !avecDlc.value,
      hideDate: !avecDate.value,
      hideQuantite: !modeCarton.value,
      carton: modeCarton.value,
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
      quantite: quantiteFinale.value,
      png: apercu.value,
      carton: modeCarton.value,
    })
    message.success(
      `${quantiteFinale.value} étiquette${quantiteFinale.value > 1 ? 's' : ''} ajoutée${quantiteFinale.value > 1 ? 's' : ''} à la file d'impression`
    )
    // la popup reste ouverte : on peut relancer une impression (autre quantité,
    // autre date…) sans avoir à rouvrir le modèle depuis le kiosque
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
          <div class="mode-impression">
            <button
              type="button"
              class="mode-bouton"
              :class="{ actif: !modeCarton }"
              data-testid="mode-lot"
              @click="modeCarton = false"
            >
              Lot d'étiquettes
            </button>
            <button
              type="button"
              class="mode-bouton"
              :class="{ actif: modeCarton }"
              data-testid="mode-carton"
              @click="modeCarton = true"
            >
              Étiquette carton
            </button>
          </div>

          <div class="dates">
            <div class="date-choix" :class="{ inactif: !avecDate }">
              <n-checkbox v-model:checked="avecDate" data-testid="avec-date">Date de fabrication</n-checkbox>
              <!-- n-date-picker plutôt qu'un <input type="date"> natif : son format
                   d'affichage suit la locale du navigateur/OS (souvent en anglais sur
                   les postes kiosque), pas la langue de la page — ici il est forcé en
                   jj/mm/aaaa par la locale française réglée dans App.vue -->
              <n-date-picker
                v-model:value="fabrication"
                type="date"
                value-format="yyyy-MM-dd"
                :disabled="!avecDate"
                :clearable="false"
                data-testid="date-fabrication"
              />
            </div>
            <div class="date-choix" :class="{ inactif: !avecDlc }">
              <n-checkbox v-model:checked="avecDlc" data-testid="avec-dlc">Date de péremption</n-checkbox>
              <n-date-picker
                v-model:value="peremption"
                type="date"
                value-format="yyyy-MM-dd"
                :disabled="!avecDlc"
                :clearable="false"
                data-testid="date-peremption"
                @update:value="peremptionTouchee = true"
              />
            </div>
          </div>

          <div v-if="!modeCarton" class="quantite">
            <p class="info-carton">Nombre d'étiquette :</p>
            <div class="ligne-principale">
              <n-button secondary :disabled="quantite <= 1" @click="ajouterQuantite(-1)">−</n-button>
              <n-input-number
                v-model:value="quantite"
                :min="1"
                :max="99999999"
                :show-button="false"
                data-testid="quantite"
                @update:value="quantiteTouchee = true"
              />
              <n-button secondary @click="ajouterQuantite(1)">+</n-button>
            </div>
            <div class="ligne-pas">
              <n-button secondary :disabled="quantite <= 1" @click="ajouterQuantite(-5)">−5</n-button>
              <n-button secondary @click="ajouterQuantite(5)">+5</n-button>
            </div>
            <div class="ligne-pas">
              <n-button secondary :disabled="quantite <= 1" @click="ajouterQuantite(-10)">−10</n-button>
              <n-button secondary @click="ajouterQuantite(10)">+10</n-button>
            </div>
          </div>
          <div v-else class="quantite">
            <p class="info-carton">Nombre de carton :</p>
            <div class="ligne-principale">
              <n-button secondary :disabled="quantiteCarton <= 1" @click="ajouterQuantiteCarton(-1)">−</n-button>
              <n-input-number
                v-model:value="quantiteCarton"
                :min="1"
                :max="99999999"
                :show-button="false"
                data-testid="quantite-carton-a-imprimer"
              />
              <n-button secondary @click="ajouterQuantiteCarton(1)">+</n-button>
            </div>
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
  font-size: 42px; line-height: 1; padding: 6px 14px; background: none; border: none;
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
/* tablette : cibles tactiles généreuses, mais sans excès */
.reglages { width: 420px; display: flex; flex-direction: column; gap: 18px; min-height: 0; overflow-y: auto; }
.mode-impression { display: flex; gap: 10px; }
.mode-bouton {
  flex: 1; padding: 10px 8px; font: inherit; font-weight: 700; font-size: 15px;
  border: 2px solid #e5e5e5; border-radius: 8px; background: #fff; color: #555; cursor: pointer;
}
.mode-bouton.actif { border-color: #c1121f; color: #c1121f; background: #fdecea; }
.info-carton { font-size: 14px; color: #555; margin: 0; font-weight: 700; }
/* chaque date sur sa propre ligne, IMPRIMER calé en bas de la colonne */
.dates { display: flex; flex-direction: column; gap: 12px; }
.btn-imprimer { margin-top: auto; --n-height: 60px !important; font-size: 20px; letter-spacing: 1px; }
.date-choix { display: flex; flex-direction: column; gap: 6px; }
.date-choix :deep(.n-checkbox) { --n-size: 22px !important; --n-font-size: 15px !important; align-items: center; }
.date-choix :deep(.n-checkbox__label) { font-weight: 700; }
.date-choix :deep(.n-date-picker) { width: 100%; }
.date-choix :deep(.n-input) { --n-font-size: 15px !important; }
.inactif :deep(.n-date-picker) { opacity: 0.45; }
/* − et + de part et d'autre du champ, puis une ligne ±5 et une ligne ±10 */
.quantite { display: flex; flex-direction: column; gap: 8px; }
.quantite :deep(.n-button) { --n-height: 52px !important; height: 52px; font-size: 16px; }
.quantite :deep(.n-input-number .n-input) { --n-height: 52px !important; --n-font-size: 24px !important; }
.ligne-principale { display: flex; gap: 8px; align-items: stretch; }
.ligne-principale :deep(.n-input-number) { flex: 1; min-width: 0; }
.ligne-principale :deep(.n-button) { width: 60px; flex: none; font-size: 22px; }
.ligne-pas { display: flex; gap: 8px; }
.ligne-pas :deep(.n-button) { flex: 1; }
.quantite :deep(.n-input-number input) { text-align: center; font-weight: 700; }
.bloque { font-size: 16px; }
.bloque { color: #780000; font-weight: 700; margin: 0; }
</style>
