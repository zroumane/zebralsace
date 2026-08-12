import { api } from './api'

// Recharge automatiquement l'onglet quand un nouveau déploiement est détecté.
// Indispensable pour un onglet resté ouvert plusieurs jours (tablette kiosque) :
// sans ça, le SPA continue de tourner avec d'anciens chunks JS que le build
// suivant a supprimés — la moindre navigation plante alors en page blanche.
// Un rechargement forcé déclenche quand même le beforeunload natif : des
// modifications non enregistrées dans l'éditeur restent protégées (l'usager
// peut annuler le rechargement).
let demarre = false
let versionInitiale: string | null = null

export function useAutoReload(intervalleMs = 60_000): void {
  if (demarre) return
  demarre = true
  const tick = () =>
    api
      .get<{ version: string }>('/api/ping')
      .then(({ version }) => {
        if (versionInitiale === null) versionInitiale = version
        else if (version !== versionInitiale) window.location.reload()
      })
      .catch(() => {}) // serveur injoignable (redémarrage en cours) : au prochain tick
  tick()
  setInterval(tick, intervalleMs)
  // Chunk JS demandé introuvable (build suivant l'a supprimé) : cas typique
  // d'un onglet resté ouvert qui vient seulement de naviguer vers une route
  // pas encore chargée. Rechargement recommandé par Vite lui-même.
  window.addEventListener('vite:preloadError', () => window.location.reload())
}
