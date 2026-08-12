import { StaticCanvas, FabricObject } from 'fabric'
import { hydrateDoc } from './vars'
import { rendreCodeBarre } from './barcode'

// ponytail: fabric v6+ change son origine par défaut à 'center' ; nos docs (et l'éditeur à venir)
// raisonnent tous en left/top = coin haut-gauche. On repasse l'app entière sur cette convention ici,
// au chargement du seul module de rendu, plutôt que de répéter originX/originY sur chaque objet stocké.
FabricObject.ownDefaults.originX = 'left'
FabricObject.ownDefaults.originY = 'top'

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi)
}

export interface RenderOpts {
  widthMm: number
  heightMm: number
  dpi: number
  vars: Record<string, string>
  baseDate: Date | string
  hideDlc: boolean
  hideDate?: boolean
  hideQuantite?: boolean
  multiplier?: number
  // étiquette carton : les éléments code-barres utilisent leur valeur carton
  // au lieu de leur valeur unité (cf. hydraterCodesBarres)
  carton?: boolean
}

// Polices embarquées (@fontsource, aucun appel réseau externe). Une seule
// liste : le sélecteur de l'éditeur et l'attente de chargement en découlent.
export const FAMILLES_POLICES = [
  'Roboto',
  'Roboto Condensed',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Playfair Display',
  'Merriweather',
]
export const POLICES = FAMILLES_POLICES.flatMap((f) => [`400 16px '${f}'`, `700 16px '${f}'`])

// Régénère le bitmap de chaque élément code-barres (props.codeBarre, posé par
// l'éditeur) avec la valeur unité ou carton selon le contexte d'impression.
// scaleX/scaleY restent inchangés (même échelle de trait qu'à l'édition) :
// seules width/height suivent la taille naturelle du nouveau bitmap, donc la
// largeur totale du code-barres suit la longueur de la valeur encodée — pas
// de déformation des barres.
async function hydraterCodesBarres(doc: any, dpi: number, carton: boolean): Promise<any> {
  for (const o of doc.objects ?? []) {
    if (!o.codeBarre) continue
    const contexte = carton ? 'carton' : 'unité'
    const valeur = (carton ? o.codeBarre.valeurCarton : o.codeBarre.valeurUnite) ?? ''
    if (!valeur.trim()) continue // pas encore configurée : repère conservé, ce n'est pas une erreur
    try {
      const rendu = await rendreCodeBarre({ type: o.codeBarre.type, valeur, dpi })
      o.src = rendu.dataUrl
      o.width = rendu.width
      o.height = rendu.height
    } catch (e) {
      // remontée jusqu'à l'appelant : un repère silencieux à l'impression
      // masquerait un vrai problème (valeur invalide pour ce type)
      throw new Error(`Code-barres invalide (étiquette ${contexte}) : ${(e as Error).message ?? e}`)
    }
  }
  return doc
}

export async function renderLabel(doc: any, o: RenderOpts): Promise<string> {
  await Promise.all(POLICES.map((p) => document.fonts.load(p)))
  const canvas = new StaticCanvas(undefined, {
    width: mmToPx(o.widthMm, o.dpi),
    height: mmToPx(o.heightMm, o.dpi),
    backgroundColor: '#ffffff',
    enableRetinaScaling: false,
  })
  try {
    const hydrated = hydrateDoc(doc, o.vars, new Date(o.baseDate), o.hideDlc, o.hideDate ?? false, o.hideQuantite ?? false)
    await hydraterCodesBarres(hydrated, o.dpi, o.carton ?? false)
    await canvas.loadFromJSON(hydrated)
    // loadFromJSON réinitialise backgroundColor à undefined quand le doc n'a pas de clé "background"
    // (notre format de template n'en a pas) : on la réapplique après le chargement.
    canvas.backgroundColor = '#ffffff'
    canvas.renderAll()
    return canvas.toDataURL({ format: 'png', multiplier: o.multiplier ?? 1 })
  } finally {
    canvas.dispose()
  }
}
