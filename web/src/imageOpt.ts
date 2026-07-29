export async function optimizeImage(
  file: File,
  o: { maxWidthPx: number; resize: boolean }
): Promise<string> {
  const bmp = await createImageBitmap(file)
  const echelle = o.resize && bmp.width > o.maxWidthPx ? o.maxWidthPx / bmp.width : 1
  const w = Math.max(1, Math.round(bmp.width * echelle))
  const h = Math.max(1, Math.round(bmp.height * echelle))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    // ponytail: seuillage simple ; passer à un tramage Floyd-Steinberg si des logos en dégradés passent mal
    const v = lum < 128 ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}
