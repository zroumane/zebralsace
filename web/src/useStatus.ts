import { ref, type Ref } from 'vue'
import { api, type PrinterStatus } from './api'

const statut = ref<PrinterStatus>({ connecte: false, pret: false, message: 'vérification…' })
let demarre = false

export function useStatus(): Ref<PrinterStatus> {
  if (!demarre) {
    demarre = true
    const tick = () =>
      api
        .get<PrinterStatus>('/api/status')
        .then((s) => (statut.value = s))
        .catch(() => (statut.value = { connecte: false, pret: false, message: 'serveur injoignable' }))
    tick()
    setInterval(tick, 4000)
  }
  return statut
}
