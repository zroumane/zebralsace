// Simulateur d'imprimante Zebra : accepte le ZPL sur le port 9100 (statut ~HS,
// pannes simulables) et décode les jobs ^GFA reçus pour les afficher en direct
// sur une page de suivi (SSE). Développement sans matériel — jamais en prod.
import fs from 'node:fs'
import net from 'node:net'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { decodeGfa } from '../server/zpl'

const ZPL_PORT = Number(process.env.SIM_ZPL_PORT ?? 9100)
const WEB_PORT = Number(process.env.SIM_WEB_PORT ?? 9101)

const etat = { horsLigne: false, papier: false, ruban: false, tete: false, pause: false }

interface Job {
  date: string
  quantite: number | null
  contraste: number | null
  vitesse: number | null
  offsetX: number | null
  offsetY: number | null
  largeurPx: number
  hauteurPx: number
  image: string | null
}
const jobs: Job[] = []
const clients = new Set<http.ServerResponse>()

const b = (v: boolean) => (v ? '1' : '0')
const reponseHs = () =>
  `\x02030,${b(etat.papier)},${b(etat.pause)},1245,000,0,0,0,000,0,0,0\x03` +
  `\x02001,0,${b(etat.tete)},${b(etat.ruban)},1,2,4,0,00000000,1,000\x03`

function parseJob(zpl: string): Job {
  const num = (re: RegExp) => {
    const m = zpl.match(re)
    return m ? Number(m[1]) : null
  }
  const gfa = decodeGfa(zpl)
  return {
    date: new Date().toLocaleString('fr-FR'),
    quantite: num(/\^PQ(\d+)/),
    contraste: num(/~SD(\d+)/),
    vitesse: num(/\^PR(\d+)/),
    offsetX: num(/\^LS(-?\d+)/),
    offsetY: num(/\^LT(-?\d+)/),
    largeurPx: gfa?.largeurPx ?? 0,
    hauteurPx: gfa?.hauteurPx ?? 0,
    image: gfa ? 'data:image/png;base64,' + gfa.png.toString('base64') : null,
  }
}

function diffuser() {
  const data = `data: ${JSON.stringify({ etat, jobs })}\n\n`
  for (const c of clients) c.write(data)
}

// --- port imprimante (ZPL) ---
net
  .createServer((sock) => {
    if (etat.horsLigne) return sock.destroy()
    let buf = ''
    sock.on('data', (d) => {
      buf += d.toString('ascii')
      if (buf.includes('~HS')) {
        sock.write(reponseHs())
        buf = buf.replace('~HS', '')
      }
      let fin: number
      while ((fin = buf.indexOf('^XZ')) !== -1) {
        jobs.unshift(parseJob(buf.slice(0, fin + 3)))
        jobs.length = Math.min(jobs.length, 20)
        buf = buf.slice(fin + 3)
        diffuser()
      }
    })
    sock.on('error', () => {})
  })
  .listen(ZPL_PORT, () => console.log(`Simulateur Zebra — port ZPL : ${ZPL_PORT}`))

// --- page de suivi en direct ---
// relus à chaque requête : modifiables sans redémarrer le simulateur
const fichier = (nom: string) => fs.readFileSync(fileURLToPath(new URL(nom, import.meta.url)))

http
  .createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      clients.add(res)
      res.write(`data: ${JSON.stringify({ etat, jobs })}\n\n`)
      req.on('close', () => clients.delete(res))
      return
    }
    if (req.url === '/etat' && req.method === 'POST') {
      let corps = ''
      req.on('data', (d) => (corps += d))
      req.on('end', () => {
        Object.assign(etat, JSON.parse(corps || '{}'))
        diffuser()
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
      })
      return
    }
    if (req.url === '/page.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(fichier('page.js'))
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(fichier('page.html'))
  })
  .listen(WEB_PORT, () => console.log(`Simulateur Zebra — page de suivi : http://localhost:${WEB_PORT}`))
