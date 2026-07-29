import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { pngToGfa, buildLabelZpl, decodeGfa } from '../../server/zpl'

function makePng(width: number, height: number, noirs: Array<[number, number]>): Buffer {
  const png = new PNG({ width, height })
  png.data.fill(255) // blanc opaque
  for (const [x, y] of noirs) {
    const i = (width * y + x) << 2
    png.data[i] = png.data[i + 1] = png.data[i + 2] = 0
  }
  return PNG.sync.write(png)
}

describe('pngToGfa', () => {
  it('convertit 8x1 : pixels 0 et 7 noirs → octet 0x81', () => {
    const r = pngToGfa(makePng(8, 1, [[0, 0], [7, 0]]))
    expect(r).toEqual({ gfa: '^GFA,1,1,1,81', largeurPx: 8, hauteurPx: 1 })
  })

  it('padde chaque ligne à l\'octet (10 px → 2 octets/ligne)', () => {
    // ligne 0 : pixel 9 noir → 0x00 0x40 ; ligne 1 : pixel 0 noir → 0x80 0x00
    const r = pngToGfa(makePng(10, 2, [[9, 0], [0, 1]]))
    expect(r.gfa).toBe('^GFA,4,4,2,00408000')
  })

  it('ignore les pixels transparents', () => {
    const png = new PNG({ width: 8, height: 1 })
    png.data.fill(0) // noir MAIS alpha 0
    const r = pngToGfa(PNG.sync.write(png))
    expect(r.gfa).toBe('^GFA,1,1,1,00')
  })

  it('émet le hex en majuscules', () => {
    // pixels 0,2,4,6 noirs → 0b10101010 = 0xAA
    const r = pngToGfa(makePng(8, 1, [[0, 0], [2, 0], [4, 0], [6, 0]]))
    expect(r.gfa).toBe('^GFA,1,1,1,AA')
  })
})

describe('buildLabelZpl', () => {
  it('assemble le job complet', () => {
    const zpl = buildLabelZpl(
      { gfa: '^GFA,1,1,1,81', largeurPx: 8, hauteurPx: 1 },
      { quantite: 3, contraste: 5, vitesse: 4, offsetX: 8, offsetY: -4 }
    )
    expect(zpl).toBe('~SD05\n^XA^PW8^PR4^LT-4^LS8^FO0,0^GFA,1,1,1,81^FS^PQ3^XZ')
  })
})

describe('decodeGfa', () => {
  it('round-trip pngToGfa → decodeGfa', () => {
    const src = makePng(10, 2, [[9, 0], [0, 1]])
    const zpl = buildLabelZpl(pngToGfa(src), { quantite: 1, contraste: 15, vitesse: 4, offsetX: 0, offsetY: 0 })
    const dec = decodeGfa(zpl)!
    expect(dec.largeurPx).toBe(16) // paddé à l'octet
    expect(dec.hauteurPx).toBe(2)
    const png = PNG.sync.read(dec.png)
    const lum = (x: number, y: number) => png.data[(png.width * y + x) << 2]
    expect(lum(9, 0)).toBe(0)   // noir
    expect(lum(0, 1)).toBe(0)   // noir
    expect(lum(0, 0)).toBe(255) // blanc
  })
  it('retourne null sans ^GFA', () => {
    expect(decodeGfa('^XA^PQ1^XZ')).toBeNull()
  })
})
