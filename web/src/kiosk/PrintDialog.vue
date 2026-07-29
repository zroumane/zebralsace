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

const sansDlc = ref(false)
const quantite = ref(1)
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
      hideDlc: sansDlc.value,
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
    <n-card :title="template.nom" style="max-width: 900px" closable @close="emit('close')">
      <div class="contenu">
        <img class="apercu" :src="apercu" alt="aperçu de l'étiquette" data-testid="apercu" />
        <div class="reglages">
          <label>
            Date de fabrication
            <input v-model="fabrication" type="date" data-testid="date-fabrication" />
          </label>
          <label :class="{ inactif: sansDlc }">
            Date de péremption
            <input
              v-model="peremption"
              type="date"
              :disabled="sansDlc"
              data-testid="date-peremption"
              @input="peremptionTouchee = true"
            />
          </label>
          <n-checkbox v-model:checked="sansDlc" data-testid="sans-dlc">
            Sans date de péremption
          </n-checkbox>

          <div class="quantite">
            <n-button size="large" secondary :disabled="quantite <= 1" @click="quantite--">−</n-button>
            <n-input-number
              v-model:value="quantite"
              size="large"
              :min="1"
              :max="99999999"
              :show-button="false"
              data-testid="quantite"
            />
            <n-button size="large" secondary :disabled="quantite >= 99999999" @click="quantite++">+</n-button>
          </div>

          <n-button
            type="primary"
            size="large"
            block
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
.contenu { display: flex; gap: 24px; align-items: flex-start; }
.apercu { flex: 1; min-width: 0; border: 1px solid #e5e5e5; }
.reglages { width: 280px; display: flex; flex-direction: column; gap: 16px; }
label { display: flex; flex-direction: column; gap: 4px; font-weight: 700; }
label input { font-size: 18px; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
.inactif { opacity: 0.45; }
.quantite { display: flex; gap: 8px; }
.quantite :deep(.n-input-number) { flex: 1; }
.bloque { color: #780000; font-weight: 700; margin: 0; }
</style>
