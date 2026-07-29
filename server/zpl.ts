import { PNG } from 'pngjs'

export interface GfaImage {
  gfa: string
  largeurPx: number
  hauteurPx: number
}

export function pngToGfa(pngBuffer: Buffer): GfaImage {
  const png = PNG.sync.read(pngBuffer)
  const octetsParLigne = Math.ceil(png.width / 8)
  const total = octetsParLigne * png.height
  let hex = ''
  for (let y = 0; y < png.height; y++) {
    const ligne = Buffer.alloc(octetsParLigne)
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2]
      const opaque = png.data[i + 3] > 127
      if (opaque && lum < 128) ligne[x >> 3] |= 0x80 >> (x & 7)
    }
    hex += ligne.toString('hex').toUpperCase()
  }
  return { gfa: `^GFA,${total},${total},${octetsParLigne},${hex}`, largeurPx: png.width, hauteurPx: png.height }
}

export interface PrintOpts {
  quantite: number
  contraste: number
  vitesse: number
  offsetX: number
  offsetY: number
}

export function buildLabelZpl(img: GfaImage, o: PrintOpts): string {
  const sd = String(o.contraste).padStart(2, '0')
  return `~SD${sd}\n^XA^PW${img.largeurPx}^PR${o.vitesse}^LT${o.offsetY}^LS${o.offsetX}^FO0,0${img.gfa}^FS^PQ${o.quantite}^XZ`
}

export function decodeGfa(zpl: string): { png: Buffer; largeurPx: number; hauteurPx: number } | null {
  const m = zpl.match(/\^GFA,\d+,\d+,(\d+),([0-9A-Fa-f]+)/)
  if (!m) return null
  const octetsParLigne = Number(m[1])
  const data = Buffer.from(m[2], 'hex')
  const hauteurPx = Math.floor(data.length / octetsParLigne)
  const largeurPx = octetsParLigne * 8
  const png = new PNG({ width: largeurPx, height: hauteurPx })
  for (let y = 0; y < hauteurPx; y++) {
    for (let x = 0; x < largeurPx; x++) {
      const noir = (data[y * octetsParLigne + (x >> 3)] >> (7 - (x & 7))) & 1
      const i = (largeurPx * y + x) << 2
      const v = noir ? 0 : 255
      png.data[i] = png.data[i + 1] = png.data[i + 2] = v
      png.data[i + 3] = 255
    }
  }
  return { png: PNG.sync.write(png), largeurPx, hauteurPx }
}
