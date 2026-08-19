import type Database from 'better-sqlite3'
import { getSettings } from './db'
import { getStatus, sendZpl } from './printer'
import { buildLabelZpl, pngToGfa } from './zpl'

export interface JobFile {
  id: number
  template_nom: string
  quantite: number
  etat: 'en_attente' | 'envoi' | 'ok' | 'erreur'
  erreur_message: string | null
}

type JobInterne = JobFile & { png: string; carton: boolean }

const FINIS_CONSERVES = 10

// ponytail: file en mémoire — perdue au redémarrage du serveur (visible : la
// liste se vide à l'écran). Persister en SQLite si ça devient un vrai besoin.
export function createQueue(db: Database.Database) {
  const jobs: JobInterne[] = []
  let seq = 0
  let actif = false

  const logImpression = db.prepare(
    'INSERT INTO print_log (template_nom, quantite, statut, erreur_message, carton) VALUES (?, ?, ?, ?, ?)'
  )

  async function traiter(): Promise<void> {
    if (actif) return
    actif = true
    try {
      let job: JobInterne | undefined
      while ((job = jobs.find((j) => j.etat === 'en_attente'))) {
        job.etat = 'envoi'
        // try/catch large : une erreur DB (base verrouillée, disque plein…) ne
        // doit faire échouer que ce job, pas planter tout le process (cf.
        // process.on('unhandledRejection') dans index.ts)
        try {
          const s = getSettings(db)
          const statut = await getStatus(s.printer_ip, Number(s.printer_port))
          if (!statut.pret) {
            job.etat = 'erreur'
            job.erreur_message = statut.message
            logImpression.run(job.template_nom, job.quantite, 'erreur', statut.message, job.carton ? 1 : 0)
          } else {
            const img = pngToGfa(Buffer.from(job.png.split(',')[1], 'base64'))
            const zpl = buildLabelZpl(img, {
              quantite: job.quantite,
              contraste: Number(s.contraste),
              vitesse: Number(s.vitesse),
              offsetX: Number(s.offset_x),
              offsetY: Number(s.offset_y),
            })
            await sendZpl(s.printer_ip, Number(s.printer_port), zpl)
            job.etat = 'ok'
            logImpression.run(job.template_nom, job.quantite, 'ok', null, job.carton ? 1 : 0)
          }
        } catch (e) {
          job.etat = 'erreur'
          job.erreur_message = (e as Error).message
          console.error('échec traitement job impression', job.id, e)
          try {
            logImpression.run(job.template_nom, job.quantite, 'erreur', job.erreur_message, job.carton ? 1 : 0)
          } catch (e2) {
            console.error("échec écriture print_log (base indisponible ?)", e2)
          }
        }
        job.png = '' // le PNG ne sert plus : libère la mémoire
      }
      // ne garde que les N derniers jobs terminés à l'affichage
      let finis = jobs.filter((j) => j.etat === 'ok' || j.etat === 'erreur')
      while (finis.length > FINIS_CONSERVES) {
        jobs.splice(jobs.indexOf(finis[0]), 1)
        finis = finis.slice(1)
      }
    } finally {
      actif = false
    }
    // un job arrivé pendant le nettoyage final ? on relance
    if (jobs.some((j) => j.etat === 'en_attente')) void traiter()
  }

  return {
    enfiler(template_nom: string, quantite: number, png: string, carton: boolean): JobFile {
      const job: JobInterne = {
        id: ++seq,
        template_nom,
        quantite,
        etat: 'en_attente',
        erreur_message: null,
        png,
        carton,
      }
      jobs.push(job)
      void traiter()
      const { png: _, ...publique } = job
      return { ...publique }
    },
    snapshot(): JobFile[] {
      return jobs.map(({ png: _, ...j }) => ({ ...j }))
    },
  }
}
