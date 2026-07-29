import net from 'node:net'

export interface FakePrinter {
  port: number
  recu: string[]
  close: () => void
}

export function startFakePrinter(
  etat: { papier?: boolean; pause?: boolean; tete?: boolean; ruban?: boolean } = {}
): Promise<FakePrinter> {
  const b = (v?: boolean) => (v ? '1' : '0')
  const s1 = `\x02030,${b(etat.papier)},${b(etat.pause)},1245,000,0,0,0,000,0,0,0\x03`
  const s2 = `\x02001,0,${b(etat.tete)},${b(etat.ruban)},1,2,4,0,00000000,1,000\x03`
  return new Promise((resolve) => {
    const recu: string[] = []
    const srv = net.createServer((sock) => {
      sock.on('data', (d) => {
        const txt = d.toString('ascii')
        if (txt.includes('~HS')) sock.write(s1 + s2)
        else recu.push(txt)
      })
    })
    srv.listen(0, '127.0.0.1', () =>
      resolve({ port: (srv.address() as net.AddressInfo).port, recu, close: () => srv.close() })
    )
  })
}
