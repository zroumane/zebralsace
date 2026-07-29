import net from 'node:net'
import http from 'node:http'
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
const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Simulateur Zebra</title>
<style>
body{font-family:sans-serif;margin:0;background:#fff;color:#1c1c1c}
header{border-bottom:3px solid #c1121f;padding:12px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0;flex:1}
button{padding:8px 12px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;font:inherit}
button.actif{background:#c1121f;color:#fff;border-color:#780000}
main{padding:16px 24px;display:flex;flex-direction:column;gap:16px}
.job{border:1px solid #e5e5e5;border-radius:8px;padding:12px;display:flex;gap:16px;align-items:flex-start}
.job img{max-width:55%;border:1px solid #eee;image-rendering:pixelated}
.meta{font-size:13px;color:#444;line-height:1.8}
</style></head><body>
<header><h1>Simulateur d'imprimante Zebra</h1><div id="boutons"></div></header>
<main id="jobs"><p>En attente de demandes d'impression…</p></main>
<script>
const BASCULES = { horsLigne: 'Hors ligne', papier: 'Fin de papier', ruban: 'Fin de ruban', tete: 'Tête ouverte', pause: 'Pause' }
let etat = {}
function rendreBoutons() {
  const div = document.getElementById('boutons')
  div.innerHTML = ''
  for (const [cle, libelle] of Object.entries(BASCULES)) {
    const btn = document.createElement('button')
    btn.textContent = libelle
    btn.className = etat[cle] ? 'actif' : ''
    btn.onclick = () =>
      fetch('/etat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [cle]: !etat[cle] }),
      })
    div.appendChild(btn)
  }
}
new EventSource('/events').onmessage = (e) => {
  const d = JSON.parse(e.data)
  etat = d.etat
  rendreBoutons()
  if (d.jobs.length) {
    document.getElementById('jobs').innerHTML = d.jobs
      .map(
        (j) =>
          '<div class="job">' +
          (j.image ? '<img src="' + j.image + '">' : '') +
          '<div class="meta">' + j.date +
          '<br>Quantité : <b>' + j.quantite + '</b>' +
          '<br>' + j.largeurPx + ' × ' + j.hauteurPx + ' px' +
          '<br>Contraste ' + j.contraste + ' — vitesse ' + j.vitesse +
          ' — offsets ' + j.offsetX + ', ' + j.offsetY +
          '</div></div>'
      )
      .join('')
  }
}
</script></body></html>`

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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE)
  })
  .listen(WEB_PORT, () => console.log(`Simulateur Zebra — page de suivi : http://localhost:${WEB_PORT}`))
