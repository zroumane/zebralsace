import { StaticCanvas, FabricObject } from 'fabric'
import { hydrateDoc } from './vars'

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
  multiplier?: number
}

const POLICES = [
  '400 16px Roboto',
  '700 16px Roboto',
  "400 16px 'Roboto Condensed'",
  "700 16px 'Roboto Condensed'",
]

export async function renderLabel(doc: any, o: RenderOpts): Promise<string> {
  await Promise.all(POLICES.map((p) => document.fonts.load(p)))
  const canvas = new StaticCanvas(undefined, {
    width: mmToPx(o.widthMm, o.dpi),
    height: mmToPx(o.heightMm, o.dpi),
    backgroundColor: '#ffffff',
    enableRetinaScaling: false,
  })
  try {
    await canvas.loadFromJSON(hydrateDoc(doc, o.vars, new Date(o.baseDate), o.hideDlc))
    // loadFromJSON réinitialise backgroundColor à undefined quand le doc n'a pas de clé "background"
    // (notre format de template n'en a pas) : on la réapplique après le chargement.
    canvas.backgroundColor = '#ffffff'
    canvas.renderAll()
    return canvas.toDataURL({ format: 'png', multiplier: o.multiplier ?? 1 })
  } finally {
    canvas.dispose()
  }
}
