import { describe, it, expect } from 'vitest'
import net from 'node:net'
import { parseHs, getStatus, sendZpl } from '../../server/printer'
import { startFakePrinter } from '../e2e/fakePrinter'

const S1 = (papier = 0, pause = 0) =>
  `\x02030,${papier},${pause},1245,000,0,0,0,000,0,0,0\x03`
const S2 = (tete = 0, ruban = 0) =>
  `\x02001,0,${tete},${ruban},1,2,4,0,00000000,1,000\x03`

describe('parseHs', () => {
  it('imprimante prête', () => {
    expect(parseHs([S1(), S2()])).toEqual({ connecte: true, pret: true, message: 'imprimante connectée' })
  })
  it('tête ouverte prioritaire', () => {
    expect(parseHs([S1(1, 1), S2(1, 1)]).message).toBe("tête d'impression ouverte")
  })
  it('fin de papier', () => {
    expect(parseHs([S1(1), S2()]).message).toBe('fin de papier')
  })
  it('fin de ruban', () => {
    expect(parseHs([S1(), S2(0, 1)]).message).toBe('fin de ruban')
  })
  it('en pause', () => {
    const s = parseHs([S1(0, 1), S2()])
    expect(s).toEqual({ connecte: true, pret: false, message: 'imprimante en pause' })
  })
  it('papier prioritaire sur ruban et pause', () => {
    expect(parseHs([S1(1, 1), S2(0, 1)]).message).toBe('fin de papier')
  })
  it('ruban prioritaire sur pause', () => {
    expect(parseHs([S1(0, 1), S2(0, 1)]).message).toBe('fin de ruban')
  })
})

describe('getStatus', () => {
  it('répond prête quand ~HS répond', async () => {
    const p = await startFakePrinter()
    expect((await getStatus('127.0.0.1', p.port)).pret).toBe(true)
    p.close()
  })
  it('timeout → déconnectée, sans rejet', async () => {
    // local mute server for timeout case
    const mute = await new Promise<{ port: number; close: () => void }>((resolve) => {
      const srv = net.createServer(() => {})
      srv.listen(0, '127.0.0.1', () => resolve({ port: (srv.address() as net.AddressInfo).port, close: () => srv.close() }))
    })
    const s = await getStatus('127.0.0.1', mute.port, 200)
    expect(s.connecte).toBe(false)
    expect(s.message).toContain('injoignable')
    mute.close()
  })
  it('connexion refusée → déconnectée', async () => {
    const p = await startFakePrinter()
    p.close()
    const s = await getStatus('127.0.0.1', p.port, 500)
    expect(s.connecte).toBe(false)
  })
  it('IP vide → non configurée', async () => {
    const s = await getStatus('', 9100)
    expect(s.message).toContain('non configurée')
  })
})

describe('sendZpl', () => {
  it('envoie le job', async () => {
    const p = await startFakePrinter()
    await sendZpl('127.0.0.1', p.port, '^XA^PQ1^XZ')
    expect(p.recu.join('')).toContain('^XA^PQ1^XZ')
    p.close()
  })
  it('rejette en français quand la connexion échoue', async () => {
    const p = await startFakePrinter()
    p.close()
    await expect(sendZpl('127.0.0.1', p.port, '^XA^XZ', 500)).rejects.toThrow(/imprimante/)
  })
  it('rejette si IP vide', async () => {
    await expect(sendZpl('', 9100, '^XA^XZ')).rejects.toThrow('non configurée')
  })
})
