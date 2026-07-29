import { PNG } from 'pngjs'
import fs from 'node:fs'

fs.mkdirSync('web/public/icons', { recursive: true })

function icone(taille, fichier) {
  const png = new PNG({ width: taille, height: taille })
  const bandeH = Math.round(taille * 0.28)
  const bandeY = Math.round((taille - bandeH) / 2)
  const marge = Math.round(taille * 0.14)
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const i = (taille * y + x) << 2
      const bande = y >= bandeY && y < bandeY + bandeH && x >= marge && x < taille - marge
      const [r, g, b] = bande ? [255, 255, 255] : [0xc1, 0x12, 0x1f]
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255
    }
  }
  fs.writeFileSync(`web/public/icons/${fichier}`, PNG.sync.write(png))
}

icone(192, 'icon-192.png')
icone(512, 'icon-512.png')
icone(180, 'apple-touch-icon.png')
console.log('Icônes générées dans web/public/icons/')
