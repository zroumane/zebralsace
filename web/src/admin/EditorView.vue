<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Canvas, FabricImage, Line, Rect, Textbox } from 'fabric'
import { useMessage } from 'naive-ui'
import { api, type Globale, type Logo, type Template } from '../api'
import { mmToPx, renderLabel } from '../render'
import { addDays, computeVars } from '../vars'
import LogoLibrary from './LogoLibrary.vue'

const route = useRoute()
const message = useMessage()

const template = ref<Template | null>(null)
const canvasEl = ref<HTMLCanvasElement>()
const canvas = shallowRef<Canvas>()
const selection = shallowRef<any>(null)
const zoom = ref(1)
const dpi = ref(300)
const laize = ref(104)

const labelPx = () => ({
  w: mmToPx(template.value!.largeur_mm, dpi.value),
  h: mmToPx(template.value!.hauteur_mm, dpi.value),
})

function appliquerDimensions() {
  const c = canvas.value!
  const { w, h } = labelPx()
  c.setZoom(zoom.value)
  c.setDimensions({ width: w * zoom.value, height: h * zoom.value })
}

function dessinerGrille() {
  const c = canvas.value!
  c.getObjects().filter((o: any) => o.estGrille).forEach((o) => c.remove(o))
  const { w, h } = labelPx()
  const pas = mmToPx(5, dpi.value)
  const opts = { stroke: '#eeeeee', strokeWidth: 1, selectable: false, evented: false, excludeFromExport: true }
  for (let x = pas; x < w; x += pas) {
    const l = new Line([x, 0, x, h], opts)
    ;(l as any).estGrille = true
    c.add(l)
    c.sendObjectToBack(l)
  }
  for (let y = pas; y < h; y += pas) {
    const l = new Line([0, y, w, y], opts)
    ;(l as any).estGrille = true
    c.add(l)
    c.sendObjectToBack(l)
  }
}

function ajouterTexte() {
  const c = canvas.value!
  const t = new Textbox('Texte', {
    left: mmToPx(5, dpi.value),
    top: mmToPx(5, dpi.value),
    width: mmToPx(40, dpi.value),
    fontFamily: 'Roboto',
    fontSize: mmToPx(3, dpi.value),
    fill: '#000000',
  })
  c.add(t)
  c.setActiveObject(t)
  c.renderAll()
}

async function placerImage(logo: Logo) {
  const img = await FabricImage.fromURL(`/logos/${logo.chemin_fichier}`)
  if (logo.type !== 'code-barres' && img.width! > mmToPx(30, dpi.value)) {
    img.scaleToWidth(mmToPx(30, dpi.value))
  } // ponytail: un code-barres est posé à sa taille native — jamais agrandi, pour rester scannable
  img.set({ left: mmToPx(5, dpi.value), top: mmToPx(5, dpi.value) })
  canvas.value!.add(img)
  canvas.value!.setActiveObject(img)
  canvas.value!.renderAll()
}

// Propriétés texte : copie locale sur sélection, application au changement
const police = ref('Roboto')
const taille = ref(24)
const alignement = ref('left')
watch(selection, (s: any) => {
  if (s?.text !== undefined) {
    police.value = s.fontFamily
    taille.value = s.fontSize
    alignement.value = s.textAlign ?? 'left'
  }
})
function appliquer(prop: string, valeur: unknown) {
  const o: any = selection.value
  if (!o) return
  o.set(prop, valeur)
  canvas.value!.requestRenderAll()
}
watch(police, (v) => appliquer('fontFamily', v))
watch(taille, (v) => appliquer('fontSize', v))
watch(alignement, (v) => appliquer('textAlign', v))

// Gras/italique : portion sélectionnée en mode édition, sinon tout le bloc
function basculerStyle(prop: 'fontWeight' | 'fontStyle', actif: string, normal: string) {
  const o: any = selection.value
  if (!o) return
  if (o.isEditing && o.selectionStart !== o.selectionEnd) {
    const courant = o.getSelectionStyles()[0]?.[prop]
    o.setSelectionStyles({ [prop]: courant === actif ? normal : actif })
  } else {
    o.set(prop, o[prop] === actif ? normal : actif)
  }
  canvas.value!.requestRenderAll()
}

// Variables disponibles
const globales = ref<Globale[]>([])
api.get<Globale[]>('/api/globals').then((g) => (globales.value = g))

function insererVariable(v: string) {
  const o: any = canvas.value?.getActiveObject()
  if (!o?.isEditing) {
    message.info("Double-cliquez d'abord dans un bloc texte, puis insérez la variable")
    return
  }
  const pos = o.selectionStart
  o.insertChars(v, undefined, o.selectionStart, o.selectionEnd)
  o.selectionStart = o.selectionEnd = pos + v.length
  // insertChars ne touche pas le textarea caché : fabric le resynchronise lui-même ainsi
  // après ses propres insertions programmatiques (cf. dropHandler dans ITextClickBehavior).
  // Sans ça, la frappe suivante est diffée contre une valeur de textarea périmée (onInput)
  // et corrompt le texte/les styles.
  if (o.hiddenTextarea) {
    o.hiddenTextarea.value = o.text
    o._updateTextarea()
    // le clic sur le bouton variable a déplacé le focus DOM hors du textarea caché ;
    // on le refocalise pour que la frappe suivante continue dans le bloc texte (cf. dropHandler).
    o.hiddenTextarea.focus()
  }
  canvas.value!.requestRenderAll()
}

onMounted(async () => {
  template.value = await api.get<Template>(`/api/templates/${route.params.id}`)
  const reglages = await api.get<Record<string, string>>('/api/settings')
  dpi.value = Number(reglages.dpi)
  laize.value = Number(reglages.laize_mm ?? 104)
  await Promise.all(['400 16px Roboto', '700 16px Roboto'].map((f) => document.fonts.load(f)))

  const c = new Canvas(canvasEl.value!, { backgroundColor: '#ffffff', preserveObjectStacking: true })
  canvas.value = c
  await c.loadFromJSON(JSON.parse(template.value.doc_json))
  // loadFromJSON réinitialise backgroundColor à undefined (voir render.ts) : on la réapplique.
  c.backgroundColor = '#ffffff'
  appliquerDimensions()
  dessinerGrille()

  const pas1 = mmToPx(1, dpi.value)
  c.on('object:moving', (e) => {
    const o = e.target!
    o.set({ left: Math.round(o.left! / pas1) * pas1, top: Math.round(o.top! / pas1) * pas1 })
  })
  c.on('selection:created', () => (selection.value = c.getActiveObject()))
  c.on('selection:updated', () => (selection.value = c.getActiveObject()))
  c.on('selection:cleared', () => (selection.value = null))
  c.renderAll()
})

watch([zoom, () => template.value?.largeur_mm, () => template.value?.hauteur_mm], () => {
  if (canvas.value && template.value) {
    appliquerDimensions()
    dessinerGrille()
    canvas.value.renderAll()
  }
})

function surTouche(e: KeyboardEvent) {
  const c = canvas.value
  const actif: any = c?.getActiveObject()
  if (c && actif && !actif.isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
    c.getActiveObjects().forEach((o) => c.remove(o))
    c.discardActiveObject()
    c.renderAll()
    e.preventDefault()
  }
}
window.addEventListener('keydown', surTouche)
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))

async function rendreCourant(multiplier: number): Promise<string> {
  const t = template.value!
  const globales = await api.get<Globale[]>('/api/globals')
  const auj = new Date()
  return renderLabel(canvas.value!.toJSON(), {
    widthMm: t.largeur_mm,
    heightMm: t.hauteur_mm,
    dpi: dpi.value,
    vars: computeVars(globales, auj, addDays(auj, t.dlc_jours)),
    baseDate: auj,
    hideDlc: false,
    multiplier,
  })
}

function ajouterCadre() {
  const c = canvas.value!
  c.add(
    new Rect({
      left: mmToPx(5, dpi.value),
      top: mmToPx(5, dpi.value),
      width: mmToPx(30, dpi.value),
      height: mmToPx(15, dpi.value),
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 3,
    })
  )
  c.renderAll()
}

function ajouterTrait() {
  const c = canvas.value!
  const l = new Line([0, 0, mmToPx(40, dpi.value), 0], {
    left: mmToPx(5, dpi.value),
    top: mmToPx(10, dpi.value),
    stroke: '#000000',
    strokeWidth: 3,
  })
  c.add(l)
  c.renderAll()
}

// Génération de codes-barres — bwip-js, 100 % locale (aucun service externe).
// Le code est généré en PNG net à la résolution active puis inséré comme une
// image ordinaire : le chemin de rendu unique reste inchangé.
const codeBarres = ref(false)
const cbType = ref('ean13')
const cbValeur = ref('')

async function genererCodeBarres() {
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
    const img = await FabricImage.fromURL(c.toDataURL('image/png'))
    // posé à taille native — comme un code-barres importé, jamais agrandi
    img.set({ left: mmToPx(5, dpi.value), top: mmToPx(5, dpi.value) })
    canvas.value!.add(img)
    canvas.value!.setActiveObject(img)
    canvas.value!.renderAll()
    codeBarres.value = false
    cbValeur.value = ''
  } catch (e) {
    message.error(`Code-barres invalide : ${String((e as Error).message ?? e)}`)
  }
}

const apercuJour = ref<string | null>(null)
async function apercuValeursDuJour() {
  apercuJour.value = await rendreCourant(1)
}

async function imprimerTest() {
  try {
    await api.post('/api/print', {
      template_nom: `${template.value!.nom} (test)`,
      quantite: 1,
      png: await rendreCourant(1),
    })
    message.success('Étiquette de test envoyée')
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function enregistrer() {
  const t = template.value!
  try {
    template.value = await api.put<Template>(`/api/templates/${t.id}`, {
      nom: t.nom,
      largeur_mm: t.largeur_mm,
      hauteur_mm: t.hauteur_mm,
      dlc_jours: t.dlc_jours,
      doc_json: JSON.stringify(canvas.value!.toJSON()),
      vignette_png: await rendreCourant(0.3),
    })
    message.success('Modèle enregistré')
  } catch (e) {
    message.error((e as Error).message)
  }
}
</script>

<template>
  <div v-if="template" class="editeur">
    <header>
      <router-link to="/admin">← Retour</router-link>
      <n-input v-model:value="template.nom" data-testid="nom-template" style="max-width: 240px" />
      <label>Largeur (mm) <n-input-number v-model:value="template.largeur_mm" :min="10" :max="laize" size="small" /></label>
      <label>Hauteur (mm) <n-input-number v-model:value="template.hauteur_mm" :min="10" :max="300" size="small" /></label>
      <label>DLC (jours) <n-input-number v-model:value="template.dlc_jours" :min="0" :max="365" size="small" /></label>
      <n-select
        v-model:value="zoom"
        size="small"
        style="width: 100px"
        :options="[0.5, 1, 1.5, 2].map((v) => ({ label: `${v * 100} %`, value: v }))"
      />
      <n-button type="primary" data-testid="enregistrer" @click="enregistrer">Enregistrer</n-button>
    </header>

    <div class="corps">
      <div class="outils">
        <!-- boutons d'ajout : tasks 13, 14, 15 -->
        <n-button data-testid="ajouter-texte" @click="ajouterTexte">+ Texte</n-button>
        <n-button @click="ajouterCadre">+ Cadre</n-button>
        <n-button @click="ajouterTrait">+ Trait</n-button>
        <n-button data-testid="ajouter-code-barres" @click="codeBarres = true">+ Code-barres</n-button>
        <n-button tertiary data-testid="apercu-jour" @click="apercuValeursDuJour">Aperçu valeurs du jour</n-button>
        <n-button tertiary data-testid="imprimer-test" @click="imprimerTest">Imprimer un test</n-button>
        <b>Images</b>
        <LogoLibrary mode="pick" @pick="placerImage" />
      </div>
      <div class="zone-canvas"><canvas ref="canvasEl" /></div>
      <div class="props">
        <!-- panneau de propriétés : task 13 -->
        <template v-if="selection?.text !== undefined">
          <b>Bloc texte</b>
          <n-select
            v-model:value="police"
            :options="[
              { label: 'Roboto', value: 'Roboto' },
              { label: 'Roboto Condensed', value: 'Roboto Condensed' },
            ]"
          />
          <n-input-number v-model:value="taille" :min="8" :max="400">
            <template #suffix>px</template>
          </n-input-number>
          <n-select
            v-model:value="alignement"
            :options="[
              { label: 'Gauche', value: 'left' },
              { label: 'Centré', value: 'center' },
              { label: 'Droite', value: 'right' },
            ]"
          />
          <div style="display: flex; gap: 8px">
            <n-button @click="basculerStyle('fontWeight', '700', '400')"><b>G</b></n-button>
            <n-button @click="basculerStyle('fontStyle', 'italic', 'normal')"><i>I</i></n-button>
          </div>
        </template>

        <b>Variables</b>
        <n-button
          v-for="v in ['{{date}}', '{{dlc}}', '{{date+7}}', ...globales.map((g) => `{{${g.cle}}}`)]"
          :key="v"
          size="small"
          tertiary
          @click="insererVariable(v)"
        >
          {{ v }}
        </n-button>
      </div>
    </div>

    <n-modal :show="codeBarres" @update:show="codeBarres = false">
      <n-card title="Générer un code-barres" style="max-width: 420px" closable @close="codeBarres = false">
        <div style="display: flex; flex-direction: column; gap: 12px">
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
          <n-button type="primary" data-testid="cb-generer" @click="genererCodeBarres">
            Générer et insérer
          </n-button>
        </div>
      </n-card>
    </n-modal>

    <n-modal :show="!!apercuJour" @update:show="apercuJour = null">
      <n-card title="Aperçu (valeurs du jour)" style="max-width: 900px" closable @close="apercuJour = null">
        <img v-if="apercuJour" :src="apercuJour" alt="aperçu" style="width: 100%; border: 1px solid #e5e5e5" />
      </n-card>
    </n-modal>
  </div>
</template>

<style scoped>
.editeur { min-height: 100vh; display: flex; flex-direction: column; }
header {
  display: flex; align-items: center; gap: 16px; padding: 10px 16px;
  border-bottom: 3px solid #c1121f; flex-wrap: wrap;
}
header label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.corps { flex: 1; display: flex; min-height: 0; }
.outils { width: 200px; padding: 12px; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; gap: 8px; }
.zone-canvas { flex: 1; overflow: auto; background: #f7f7f7; padding: 24px; }
.zone-canvas canvas { box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15); }
.props { width: 260px; padding: 12px; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column; gap: 12px; }
</style>
