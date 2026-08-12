// Rendu de code-barres 100 % local (bwip-js) : jamais d'appel réseau, ni à
// l'édition ni à l'impression. Partagé entre l'éditeur (repère à l'édition)
// et le moteur de rendu (impression, qui choisit la valeur unité ou carton).

export interface OptionsCodeBarre {
  type: string
  valeur: string
  dpi: number
}

export interface CodeBarreRendu {
  dataUrl: string
  width: number
  height: number
}

// GLN (GS1) en premier et par défaut : identifiant de lieu-fonction GS1, le
// plus utilisé ici. Encodé en Code 128 brut (juste les 13 chiffres, sans
// l'habillage GS1-128/AI 414) — un choix délibéré, plus lisible visuellement,
// au prix de ne plus être un GS1-128 strictement normalisé.
export const TYPES_CODE_BARRE = [
  { label: 'GLN (GS1, localisation)', value: 'gln' },
  { label: 'EAN-13 (produit)', value: 'ean13' },
  { label: 'Code 128 (alphanumérique)', value: 'code128' },
  { label: 'QR Code', value: 'qrcode' },
]

// Clé de contrôle GS1/EAN Mod10 à partir des 12 premiers chiffres — même
// algorithme pour un EAN-13 que pour un GLN.
function cleControleGS1(douzeChiffres: string): string {
  let somme = 0
  for (let i = 0; i < 12; i++) {
    somme += Number(douzeChiffres[11 - i]) * (i % 2 === 0 ? 3 : 1)
  }
  return String((10 - (somme % 10)) % 10)
}

export async function rendreCodeBarre(o: OptionsCodeBarre): Promise<CodeBarreRendu> {
  const { default: bwipjs } = await import('bwip-js')
  const c = document.createElement('canvas')
  let valeur = o.valeur.trim()
  let bcid = o.type
  if (o.type === 'ean13' && /^\d{13}$/.test(valeur)) {
    // 13e chiffre = clé de contrôle : recalculée par bwip-js à partir des 12
    // premiers (natif à ean13) — une clé mal recopiée depuis l'emballage ne
    // doit pas faire échouer tout le code-barres.
    valeur = valeur.slice(0, 12)
  } else if (o.type === 'gln') {
    // GLN : pas de symbologie dédiée — Code 128 brut sur les 13 chiffres.
    // Une clé de contrôle mal recopiée (ou absente, 12 chiffres tapés) est
    // recalculée, même tolérance qu'un EAN-13.
    bcid = 'code128'
    const chiffres = /^\d{12,13}$/.test(valeur) ? valeur.slice(0, 12) : valeur
    valeur = /^\d{12}$/.test(chiffres) ? chiffres + cleControleGS1(chiffres) : chiffres
  }
  const opts: Record<string, unknown> = {
    bcid,
    text: valeur,
    scale: Math.max(2, Math.round(o.dpi / 100)),
  }
  if (o.type !== 'qrcode') {
    opts.height = 12
    opts.includetext = true
    opts.textxalign = 'center'
  }
  bwipjs.toCanvas(c, opts as never)
  return { dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height }
}
