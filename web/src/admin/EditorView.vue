<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Canvas, FabricImage, FabricText, Group, Line, Rect, Textbox } from 'fabric'
import { useMessage } from 'naive-ui'
import { api, type Globale, type Logo, type Template } from '../api'
import { mmToPx, renderLabel } from '../render'
import { addDays, computeVars } from '../vars'
import BoutonRetour from '../BoutonRetour.vue'
import LogoLibrary from './LogoLibrary.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

// --- modifications non enregistrées ---
const modifie = ref(false)
const pret = ref(false) // vrai une fois le chargement initial terminé
// ébauche créée par « + Nouveau modèle », jamais enregistrée par l'utilisateur
const jamaisEnregistre = ref(route.query.neuf === '1')

function avantFermeture(e: BeforeUnloadEvent) {
  if (!modifie.value && !jamaisEnregistre.value) return
  e.preventDefault()
  e.returnValue = '' // requis par Chrome pour afficher l'alerte native
}
window.addEventListener('beforeunload', avantFermeture)
onBeforeUnmount(() => window.removeEventListener('beforeunload', avantFermeture))

onBeforeRouteLeave(async () => {
  // confirm natif : cohérent avec l'alerte du navigateur à la fermeture d'onglet
  if (jamaisEnregistre.value) {
    const ok = window.confirm(
      "Ce nouveau modèle n'a jamais été enregistré — quitter le supprimera. Quitter quand même ?"
    )
    if (ok) await api.del(`/api/templates/${route.params.id}`) // l'ébauche disparaît
    return ok
  }
  if (!modifie.value) return true
  return window.confirm('Modifications non enregistrées — quitter sans enregistrer ?')
})

const template = ref<Template | null>(null)
const canvasEl = ref<HTMLCanvasElement>()
const canvas = shallowRef<Canvas>()
const zoneCanvas = ref<HTMLElement>()

// --- zoom (Ctrl + molette, centré sur le curseur) et déplacement (Ctrl + glisser) ---
function changerZoom(facteur: number, pivot?: { x: number; y: number }) {
  const nouveau = Math.min(4, Math.max(0.25, zoom.value * facteur))
  if (nouveau === zoom.value) return
  const zone = zoneCanvas.value
  const ratio = nouveau / zoom.value
  const rect = zone?.getBoundingClientRect()
  const px = pivot && rect ? pivot.x - rect.left : 0
  const py = pivot && rect ? pivot.y - rect.top : 0
  const cx = zone ? zone.scrollLeft + px : 0
  const cy = zone ? zone.scrollTop + py : 0
  zoom.value = nouveau // le watch redimensionne le canvas et redessine la grille
  requestAnimationFrame(() => {
    if (!zone) return
    zone.scrollLeft = cx * ratio - px
    zone.scrollTop = cy * ratio - py
  })
}

function surMolette(e: WheelEvent) {
  if (!e.ctrlKey) return // molette seule = défilement normal de la zone
  e.preventDefault()
  changerZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, { x: e.clientX, y: e.clientY })
}

let pan: { x: number; y: number; sx: number; sy: number } | null = null
function debutPan(e: MouseEvent) {
  if (!e.ctrlKey || e.button !== 0) return
  e.preventDefault()
  e.stopPropagation() // fabric ne doit ni sélectionner ni déplacer d'objet
  const zone = zoneCanvas.value!
  pan = { x: e.clientX, y: e.clientY, sx: zone.scrollLeft, sy: zone.scrollTop }
  zone.classList.add('pan-en-cours')
  window.addEventListener('mousemove', bougePan)
  window.addEventListener('mouseup', finPan)
}
function bougePan(e: MouseEvent) {
  if (!pan) return
  const zone = zoneCanvas.value!
  zone.scrollLeft = pan.sx - (e.clientX - pan.x)
  zone.scrollTop = pan.sy - (e.clientY - pan.y)
}
function finPan() {
  pan = null
  zoneCanvas.value?.classList.remove('pan-en-cours')
  window.removeEventListener('mousemove', bougePan)
  window.removeEventListener('mouseup', finPan)
}
onBeforeUnmount(finPan)

// --- historique : annuler / rétablir (instantanés JSON du canvas) ---
const pileAnnuler: string[] = []
const pileRetablir: string[] = []
let etatCourant = ''
let enRestauration = false
const peutAnnuler = ref(false)
const peutRetablir = ref(false)

function instantaneCanvas(): string {
  return JSON.stringify(canvas.value!.toObject(['tableauNutritionnel']))
}
function majHistorique() {
  peutAnnuler.value = pileAnnuler.length > 0
  peutRetablir.value = pileRetablir.length > 0
}
function empilerHistorique() {
  pileAnnuler.push(etatCourant)
  if (pileAnnuler.length > 50) pileAnnuler.shift()
  pileRetablir.length = 0
  etatCourant = instantaneCanvas()
  majHistorique()
}
async function restaurer(etat: string) {
  enRestauration = true
  const c = canvas.value!
  await c.loadFromJSON(JSON.parse(etat))
  c.backgroundColor = '#ffffff'
  c.getObjects().forEach(protegerObjet)
  dessinerGrille()
  selection.value = null
  c.renderAll()
  enRestauration = false
}
async function annuler() {
  if (!pileAnnuler.length) return
  pileRetablir.push(etatCourant)
  etatCourant = pileAnnuler.pop()!
  await restaurer(etatCourant)
  modifie.value = true
  majHistorique()
}
async function retablir() {
  if (!pileRetablir.length) return
  pileAnnuler.push(etatCourant)
  etatCourant = pileRetablir.pop()!
  await restaurer(etatCourant)
  modifie.value = true
  majHistorique()
}
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

// Seuls les rectangles se redimensionnent librement (uniformScaling: false).
// Tout le reste est verrouillé :
// - texte : jamais étiré — il ne dépend que de son contenu et de sa taille de
//   police ; les poignées latérales ne font que reformater la largeur ;
// - images, tableaux… : ratio conservé (angles seuls, scaleY asservi à scaleX
//   par l'écouteur object:scaling).
function estLibre(o: any) {
  return String(o.type).toLowerCase() === 'rect'
}
function protegerObjet(o: any) {
  if (o.estGrille || estLibre(o)) return
  if (o.text !== undefined) {
    o.setControlsVisibility({ tl: false, tr: false, bl: false, br: false })
  } else {
    o.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false })
    o.lockScalingFlip = true
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
  protegerObjet(t)
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

// Gras/italique/souligné : portion sélectionnée en mode édition, sinon tout
// le bloc. Un style posé sur une variable {{...}} est conservé après
// substitution (les plages de style sont étirées par le moteur de variables).
function basculerStyle(
  prop: 'fontWeight' | 'fontStyle' | 'underline',
  actif: string | boolean,
  normal: string | boolean
) {
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

  const c = new Canvas(canvasEl.value!, {
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
    // poignées d'angle libres (pas de ratio verrouillé) ; Maj enfoncée = ratio conservé
    uniformScaling: false,
  })
  canvas.value = c
  await c.loadFromJSON(JSON.parse(template.value.doc_json))
  // loadFromJSON réinitialise backgroundColor à undefined (voir render.ts) : on la réapplique.
  c.backgroundColor = '#ffffff'
  c.getObjects().forEach(protegerObjet)
  appliquerDimensions()
  dessinerGrille()

  const pas1 = mmToPx(1, dpi.value)
  c.on('object:scaling', (e: any) => {
    const o = e.target
    if (!o || o.text !== undefined || estLibre(o)) return
    o.scaleY = o.scaleX // ratio verrouillé pour tout sauf les rectangles
  })
  c.on('object:moving', (e) => {
    const o = e.target!
    o.set({ left: Math.round(o.left! / pas1) * pas1, top: Math.round(o.top! / pas1) * pas1 })
  })
  c.on('selection:created', () => (selection.value = c.getActiveObject()))
  c.on('selection:updated', () => (selection.value = c.getActiveObject()))
  c.on('selection:cleared', () => (selection.value = null))

  // traque les modifications (la grille, jamais sérialisée, ne compte pas)
  const marquer = (e?: { target?: { estGrille?: boolean } }) => {
    if (enRestauration || e?.target?.estGrille) return
    modifie.value = true
    empilerHistorique()
  }
  c.on('object:added', marquer)
  c.on('object:removed', marquer)
  c.on('object:modified', marquer)
  c.on('text:changed', marquer)

  c.renderAll()
  etatCourant = instantaneCanvas() // point de départ de l'historique
  pret.value = true
})

// les propriétés du modèle comptent aussi comme modifications (pas le zoom).
// Sources primitives : ne se déclenche que si une VALEUR change réellement.
watch(
  [
    () => template.value?.nom,
    () => template.value?.largeur_mm,
    () => template.value?.hauteur_mm,
    () => template.value?.dlc_jours,
  ],
  () => {
    if (pret.value) modifie.value = true
  }
)

watch([zoom, () => template.value?.largeur_mm, () => template.value?.hauteur_mm], () => {
  if (canvas.value && template.value) {
    appliquerDimensions()
    dessinerGrille()
    canvas.value.renderAll()
  }
})

function surTouche(e: KeyboardEvent) {
  const c = canvas.value
  if (!c) return
  // Ctrl/Cmd+Z = annuler ; Ctrl/Cmd+Y ou Ctrl/Cmd+Maj+Z = rétablir
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    void (e.shiftKey ? retablir() : annuler())
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    void retablir()
    return
  }
  const actif: any = c.getActiveObject()
  if (actif && !actif.isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
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
  return renderLabel(canvas.value!.toObject(['tableauNutritionnel']), {
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
      rx: mmToPx(1.5, dpi.value),
      ry: mmToPx(1.5, dpi.value),
    })
  )
  c.renderAll()
}

// rectangle plein à bords arrondis (cartouche — typiquement noir sous texte blanc)
// Bords carrés possibles via le panneau : un rectangle plat = un trait.
function ajouterRectanglePlein() {
  const c = canvas.value!
  const r = new Rect({
    left: mmToPx(5, dpi.value),
    top: mmToPx(5, dpi.value),
    width: mmToPx(30, dpi.value),
    height: mmToPx(10, dpi.value),
    fill: '#000000',
    rx: mmToPx(2, dpi.value),
    ry: mmToPx(2, dpi.value),
  })
  c.add(r)
  c.setActiveObject(r)
  c.renderAll()
}

// couleur du texte : portion sélectionnée en édition, sinon tout le bloc
function appliquerCouleurTexte(couleur: string) {
  const o: any = selection.value
  if (!o) return
  if (o.isEditing && o.selectionStart !== o.selectionEnd) {
    o.setSelectionStyles({ fill: couleur })
  } else {
    o.set('fill', couleur)
  }
  canvas.value!.requestRenderAll()
}

// bords d'un rectangle : arrondis (2 mm) ou carrés (0) — carrés + rectangle
// plat = un trait / une barre
function appliquerBords(rayonMm: number) {
  const o: any = selection.value
  if (!o || o.rx === undefined) return
  const r = mmToPx(rayonMm, dpi.value)
  o.set({ rx: r, ry: r })
  o.dirty = true
  canvas.value!.requestRenderAll()
}

// couleur d'une forme : le fond s'il est plein, le trait s'il existe
function appliquerCouleurForme(couleur: string) {
  const o: any = selection.value
  if (!o) return
  if (o.fill && o.fill !== 'transparent') o.set('fill', couleur)
  if (o.stroke) o.set('stroke', couleur)
  canvas.value!.requestRenderAll()
}

// --- tableau nutritionnel (format INCO : libellés fixes, valeurs éditables) ---
interface ValeursNutritionnelles {
  titre: string
  energie: string
  lipides: string
  satures: string
  glucides: string
  sucres: string
  proteines: string
  sel: string
}

const LIGNES_NUT: Array<{ label: string; cle: keyof ValeursNutritionnelles; sep: boolean }> = [
  { label: 'Énergie', cle: 'energie', sep: true },
  { label: 'Lipides', cle: 'lipides', sep: false },
  { label: 'dont acides gras saturés', cle: 'satures', sep: true },
  { label: 'Glucides', cle: 'glucides', sep: false },
  { label: 'dont sucres', cle: 'sucres', sep: true },
  { label: 'Protéines', cle: 'proteines', sep: true },
  { label: 'Sel', cle: 'sel', sep: false },
]

const NUT_DEFAUT = (): ValeursNutritionnelles => ({
  titre: 'Valeurs nutritives moyennes pour 100 g',
  energie: '',
  lipides: '',
  satures: '',
  glucides: '',
  sucres: '',
  proteines: '',
  sel: '',
})

const tableauOuvert = ref(false)
// shallowRef obligatoire : une ref profonde enrobe l'objet fabric dans un Proxy
// et canvas.remove(proxy) ne retrouve pas l'instance originale
const tableauEnEdition = shallowRef<any>(null)
const valNut = ref<ValeursNutritionnelles>(NUT_DEFAUT())

function construireTableau(v: ValeursNutritionnelles): Group {
  const mm = (x: number) => mmToPx(x, dpi.value)
  const largeur = mm(60)
  const pad = mm(2)
  const ligneH = mm(4.6)
  const police = { fontFamily: 'Roboto', fill: '#000000' }
  const elements: any[] = []
  let y = pad

  elements.push(
    new Textbox(v.titre, {
      left: 0,
      top: y,
      width: largeur,
      fontSize: mm(3),
      fontWeight: '700',
      textAlign: 'center',
      ...police,
    })
  )
  y += ligneH
  elements.push(new Line([pad / 2, y, largeur - pad / 2, y], { stroke: '#000000', strokeWidth: 2 }))
  y += mm(1)

  for (const l of LIGNES_NUT) {
    const valeur = v[l.cle].trim()
    if (!valeur) continue
    elements.push(new FabricText(l.label, { left: pad, top: y, fontSize: mm(2.8), ...police }))
    const t = new FabricText(valeur, { fontSize: mm(2.8), ...police })
    t.set({ left: largeur - pad - t.width!, top: y })
    elements.push(t)
    y += ligneH
    if (l.sep) {
      elements.push(
        new Line([pad / 2, y - mm(0.7), largeur - pad / 2, y - mm(0.7)], { stroke: '#000000', strokeWidth: 2 })
      )
      y += mm(0.6)
    }
  }

  elements.unshift(
    new Rect({
      left: 0,
      top: 0,
      width: largeur,
      height: y + pad,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 3,
      rx: mm(1.5),
      ry: mm(1.5),
    })
  )
  const g = new Group(elements, { left: mm(5), top: mm(5) })
  ;(g as any).tableauNutritionnel = { ...v }
  return g
}

function ouvrirTableau() {
  tableauEnEdition.value = null
  valNut.value = NUT_DEFAUT()
  tableauOuvert.value = true
}

function ouvrirEditionTableau() {
  const o: any = selection.value
  if (!o?.tableauNutritionnel) return
  tableauEnEdition.value = o
  valNut.value = { ...NUT_DEFAUT(), ...o.tableauNutritionnel }
  tableauOuvert.value = true
}

function validerTableau() {
  const c = canvas.value!
  const g = construireTableau(valNut.value)
  const ancien: any = tableauEnEdition.value
  if (ancien) {
    g.set({ left: ancien.left, top: ancien.top, scaleX: ancien.scaleX, scaleY: ancien.scaleY, angle: ancien.angle })
    c.remove(ancien)
  }
  c.add(g)
  c.setActiveObject(g)
  c.renderAll()
  tableauOuvert.value = false
  tableauEnEdition.value = null
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
    // ne PAS réassigner template.value avec la réponse : cela redéclencherait
    // le traqueur de modifications juste après sa remise à zéro
    await api.put<Template>(`/api/templates/${t.id}`, {
      nom: t.nom,
      largeur_mm: t.largeur_mm,
      hauteur_mm: t.hauteur_mm,
      dlc_jours: t.dlc_jours,
      // toObject(['tableauNutritionnel']) : conserve les valeurs des tableaux
      // nutritionnels pour pouvoir les rééditer
      doc_json: JSON.stringify(canvas.value!.toObject(['tableauNutritionnel'])),
      vignette_png: await rendreCourant(0.3),
    })
    modifie.value = false
    if (jamaisEnregistre.value) {
      jamaisEnregistre.value = false
      void router.replace(route.path) // retire ?neuf=1 (un rechargement ne doit pas le réarmer)
    }
    message.success('Modèle enregistré')
  } catch (e) {
    message.error((e as Error).message)
  }
}
</script>

<template>
  <div v-if="template" class="editeur">
    <header>
      <BoutonRetour to="/admin/modeles" libelle="Retour" />
      <n-button type="primary" size="large" strong data-testid="enregistrer" @click="enregistrer">
        Enregistrer
      </n-button>
      <n-input v-model:value="template.nom" data-testid="nom-template" style="max-width: 240px" />
      <label>Largeur (mm) <n-input-number v-model:value="template.largeur_mm" :min="10" :max="laize" size="small" /></label>
      <label>Hauteur (mm) <n-input-number v-model:value="template.hauteur_mm" :min="10" :max="300" size="small" /></label>
      <label>DLC (jours) <n-input-number v-model:value="template.dlc_jours" :min="0" :max="365" size="small" /></label>
      <div class="zoom-ctrl" title="Ctrl + molette pour zoomer, Ctrl + glisser pour se déplacer">
        <n-button size="small" quaternary @click="changerZoom(1 / 1.25)">−</n-button>
        <span class="zoom-affiche" data-testid="zoom">{{ Math.round(zoom * 100) }} %</span>
        <n-button size="small" quaternary @click="changerZoom(1.25)">+</n-button>
      </div>
    </header>

    <div class="corps">
      <div class="outils">
        <!-- boutons d'ajout : tasks 13, 14, 15 -->
        <div style="display: flex; gap: 6px">
          <n-button size="small" :disabled="!peutAnnuler" data-testid="annuler" @click="annuler" title="Ctrl+Z">↶ Annuler</n-button>
          <n-button size="small" :disabled="!peutRetablir" data-testid="retablir" @click="retablir" title="Ctrl+Y">↷</n-button>
        </div>
        <n-button data-testid="ajouter-texte" @click="ajouterTexte">+ Texte</n-button>
        <n-button @click="ajouterCadre">+ Cadre</n-button>
        <n-button data-testid="ajouter-rectangle" @click="ajouterRectanglePlein">+ Rectangle</n-button>
        <n-button data-testid="ajouter-tableau" @click="ouvrirTableau">+ Tableau nutritionnel</n-button>
        <n-button tertiary data-testid="apercu-jour" @click="apercuValeursDuJour">Aperçu</n-button>
        <n-button tertiary data-testid="imprimer-test" @click="imprimerTest">Imprimer un test</n-button>
        <b>Médias</b>
        <LogoLibrary @pick="placerImage" />
      </div>
      <div
        ref="zoneCanvas"
        class="zone-canvas"
        @wheel="surMolette"
        @mousedown.capture="debutPan"
      >
        <canvas ref="canvasEl" />
      </div>
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
          <div style="display: flex; gap: 6px">
            <n-button size="small" :type="alignement === 'left' ? 'primary' : 'default'" @click="alignement = 'left'">Gauche</n-button>
            <n-button size="small" :type="alignement === 'center' ? 'primary' : 'default'" @click="alignement = 'center'">Centré</n-button>
            <n-button size="small" :type="alignement === 'right' ? 'primary' : 'default'" @click="alignement = 'right'">Droite</n-button>
          </div>
          <div style="display: flex; gap: 8px">
            <n-button @click="basculerStyle('fontWeight', '700', '400')"><b>G</b></n-button>
            <n-button @click="basculerStyle('fontStyle', 'italic', 'normal')"><i>I</i></n-button>
            <n-button @click="basculerStyle('underline', true, false)"><u>S</u></n-button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center">
            <span class="libelle-couleur">Couleur</span>
            <n-button size="small" @click="appliquerCouleurTexte('#000000')">
              <span class="pastille noire" /> Noir
            </n-button>
            <n-button size="small" @click="appliquerCouleurTexte('#ffffff')">
              <span class="pastille blanche" /> Blanc
            </n-button>
          </div>
          <p class="astuce">
            Double-cliquez dans le bloc puis sélectionnez une portion : G, I, S et
            la couleur ne s'appliquent qu'à elle. Sans sélection, tout le bloc est
            mis en forme.
          </p>
        </template>

        <template v-else-if="selection && selection.tableauNutritionnel">
          <b>Tableau nutritionnel</b>
          <n-button size="small" data-testid="modifier-tableau" @click="ouvrirEditionTableau">
            Modifier les valeurs
          </n-button>
          <p class="astuce">Les lignes laissées vides ne sont pas affichées.</p>
        </template>

        <template v-else-if="selection && String(selection.type).toLowerCase() !== 'image'">
          <b>Forme</b>
          <div style="display: flex; gap: 8px; align-items: center">
            <span class="libelle-couleur">Couleur</span>
            <n-button size="small" @click="appliquerCouleurForme('#000000')">
              <span class="pastille noire" /> Noir
            </n-button>
            <n-button size="small" @click="appliquerCouleurForme('#ffffff')">
              <span class="pastille blanche" /> Blanc
            </n-button>
          </div>
          <div v-if="selection.rx !== undefined" style="display: flex; gap: 8px; align-items: center">
            <span class="libelle-couleur">Bords</span>
            <n-button size="small" @click="appliquerBords(2)">Arrondis</n-button>
            <n-button size="small" data-testid="bords-carres" @click="appliquerBords(0)">Carrés</n-button>
          </div>
          <p class="astuce">
            Une forme blanche est invisible sur le fond blanc de l'étiquette —
            utile posée sur un rectangle noir (texte ou détourage en blanc).
            Un rectangle plat à bords carrés fait office de trait.
          </p>
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

    <n-modal :show="tableauOuvert" @update:show="tableauOuvert = false">
      <n-card
        :title="tableauEnEdition ? 'Modifier le tableau nutritionnel' : 'Tableau nutritionnel'"
        style="max-width: 480px"
        closable
        @close="tableauOuvert = false"
      >
        <div class="form-tableau">
          <label>Titre <n-input v-model:value="valNut.titre" data-testid="nut-titre" /></label>
          <label>Énergie <n-input v-model:value="valNut.energie" data-testid="nut-energie" placeholder="ex. 217,57 kcal / 912,57 kJ" /></label>
          <label>Lipides <n-input v-model:value="valNut.lipides" data-testid="nut-lipides" placeholder="ex. 10,33 g" /></label>
          <label>dont acides gras saturés <n-input v-model:value="valNut.satures" data-testid="nut-satures" placeholder="ex. 3,76 g" /></label>
          <label>Glucides <n-input v-model:value="valNut.glucides" data-testid="nut-glucides" placeholder="ex. 5,13 g" /></label>
          <label>dont sucres <n-input v-model:value="valNut.sucres" data-testid="nut-sucres" placeholder="ex. 3,09 g" /></label>
          <label>Protéines <n-input v-model:value="valNut.proteines" data-testid="nut-proteines" placeholder="ex. 7,86 g" /></label>
          <label>Sel <n-input v-model:value="valNut.sel" data-testid="nut-sel" placeholder="ex. 1,48 g" /></label>
          <p class="astuce">Une ligne laissée vide n'apparaît pas dans le tableau.</p>
        </div>
        <template #footer>
          <n-button type="primary" data-testid="valider-tableau" @click="validerTableau">
            {{ tableauEnEdition ? 'Appliquer' : 'Insérer' }}
          </n-button>
        </template>
      </n-card>
    </n-modal>

    <n-modal :show="!!apercuJour" @update:show="apercuJour = null">
      <n-card title="Aperçu" style="max-width: 900px" closable @close="apercuJour = null">
        <img v-if="apercuJour" :src="apercuJour" alt="aperçu" style="width: 100%; border: 1px solid #e5e5e5" />
      </n-card>
    </n-modal>
  </div>
</template>

<style scoped>
/* hauteur verrouillée à la fenêtre : la page ne défile jamais,
   seule la zone canvas défile (et se déplace au Ctrl+glisser) */
.editeur { height: 100vh; display: flex; flex-direction: column; }
header {
  display: flex; align-items: center; gap: 16px; padding: 10px 16px;
  border-bottom: 3px solid #c1121f; flex-wrap: wrap;
}
header label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.corps { flex: 1; display: flex; min-height: 0; }
.outils { width: 200px; padding: 12px; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.zone-canvas { flex: 1; overflow: auto; background: #f7f7f7; padding: 24px; display: flex; }
/* centre le canvas quand il est plus petit que la zone, reste défilable sinon */
.zone-canvas :deep(.canvas-container) { margin: auto; }
.zone-canvas.pan-en-cours { cursor: grabbing; user-select: none; }
.zoom-ctrl { display: flex; align-items: center; gap: 4px; }
.zoom-affiche { font-size: 13px; color: #555; min-width: 48px; text-align: center; }
.zone-canvas canvas { box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15); }
.props { width: 260px; padding: 12px; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.astuce { font-size: 12px; color: #999; margin: 0; }
.libelle-couleur { font-size: 13px; font-weight: 700; }
.form-tableau { display: flex; flex-direction: column; gap: 10px; }
.form-tableau label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; }
.pastille { width: 12px; height: 12px; border-radius: 3px; display: inline-block; margin-right: 6px; }
.pastille.noire { background: #000; }
.pastille.blanche { background: #fff; border: 1px solid #ccc; }
</style>
