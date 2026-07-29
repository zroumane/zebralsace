async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) {
    const corps = await r.json().catch(() => ({}))
    throw new Error(corps.erreur ?? `Erreur HTTP ${r.status}`)
  }
  return r.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  get: <T>(url: string) => j<T>(url),
  post: <T>(url: string, body: unknown) => j<T>(url, json('POST', body)),
  put: <T>(url: string, body: unknown) => j<T>(url, json('PUT', body)),
  del: <T>(url: string) => j<T>(url, { method: 'DELETE' }),
}

export interface Template {
  id: number
  nom: string
  largeur_mm: number
  hauteur_mm: number
  dlc_jours: number
  doc_json: string
  vignette_png: string | null
}
export interface Globale { cle: string; valeur: string }
export interface Logo { id: number; nom: string; type: 'logo' | 'code-barres'; chemin_fichier: string }
export interface JobFile {
  id: number
  template_nom: string
  quantite: number
  etat: 'en_attente' | 'envoi' | 'ok' | 'erreur'
  erreur_message: string | null
}
export interface PrinterStatus {
  connecte: boolean
  pret: boolean
  message: string
  file?: JobFile[]
}
export interface LigneJournal {
  id: number
  date_heure: string
  template_nom: string
  quantite: number
  statut: 'ok' | 'erreur'
  erreur_message: string | null
}
