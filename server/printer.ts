import net from 'node:net'

export interface PrinterStatus {
  connecte: boolean
  pret: boolean
  message: string
}

export function parseHs(strings: string[]): PrinterStatus {
  const champs = (s: string) => s.slice(s.indexOf('\x02') + 1).split(',')
  const s1 = champs(strings[0])
  const s2 = champs(strings[1])
  const finPapier = s1[1] === '1'
  const pause = s1[2] === '1'
  const teteOuverte = s2[2] === '1'
  const finRuban = s2[3] === '1'
  if (teteOuverte) return { connecte: true, pret: false, message: "tête d'impression ouverte" }
  if (finPapier) return { connecte: true, pret: false, message: 'fin de papier' }
  if (finRuban) return { connecte: true, pret: false, message: 'fin de ruban' }
  if (pause) return { connecte: true, pret: false, message: 'imprimante en pause' }
  return { connecte: true, pret: true, message: 'imprimante connectée' }
}

const DECONNECTEE = (message: string): PrinterStatus => ({ connecte: false, pret: false, message })

export function getStatus(ip: string, port: number, timeoutMs = 2000): Promise<PrinterStatus> {
  if (!ip) return Promise.resolve(DECONNECTEE("adresse IP de l'imprimante non configurée"))
  return new Promise((resolve) => {
    const sock = net.connect({ host: ip, port })
    let buf = ''
    let fini = false
    const done = (s: PrinterStatus) => {
      if (fini) return
      fini = true
      sock.destroy()
      resolve(s)
    }
    sock.setTimeout(timeoutMs)
    sock.on('connect', () => sock.write('~HS'))
    sock.on('data', (d) => {
      buf += d.toString('ascii')
      const strings = buf.split('\x03').filter((s) => s.includes('\x02'))
      if (strings.length >= 2) done(parseHs(strings))
    })
    sock.on('timeout', () => done(DECONNECTEE('imprimante injoignable (délai dépassé)')))
    sock.on('error', () => done(DECONNECTEE('imprimante injoignable')))
  })
}

export function sendZpl(ip: string, port: number, zpl: string, timeoutMs = 5000): Promise<void> {
  if (!ip) return Promise.reject(new Error("adresse IP de l'imprimante non configurée"))
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: ip, port })
    sock.setTimeout(timeoutMs)
    sock.on('connect', () => sock.end(zpl))
    sock.on('timeout', () => sock.destroy(new Error('délai dépassé')))
    sock.on('error', (e) => reject(new Error(`envoi à l'imprimante impossible (${e.message})`)))
    sock.on('close', (hadError) => {
      if (!hadError) resolve()
    })
  })
}
