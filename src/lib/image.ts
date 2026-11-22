import { dominantColor } from './color'

export async function loadBitmap(blob: Blob) {
  return createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
}

/** Downscale an image so its longest side is at most `max` px. Returns a JPEG/PNG blob. */
export async function downscale(blob: Blob, max = 1024): Promise<Blob> {
  const bmp = await loadBitmap(blob)
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * s)
  const h = Math.round(bmp.height * s)
  const c = new OffscreenCanvas(w, h)
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
}

/**
 * Crop a transparent PNG to the bounding box of its visible pixels (plus padding),
 * and compute its dominant colour.
 */
export async function trimAndAnalyse(blob: Blob): Promise<{ blob: Blob; color: string; aspect: number }> {
  const bmp = await loadBitmap(blob)
  const { width: w, height: h } = bmp
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const { data } = ctx.getImageData(0, 0, w, h)
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const color = dominantColor(data)
  if (maxX < 0) return { blob, color, aspect: w / h }
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04)
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const out = new OffscreenCanvas(cw, ch)
  out.getContext('2d')!.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch)
  return { blob: await out.convertToBlob({ type: 'image/png' }), color, aspect: cw / ch }
}

/**
 * Offline fallback when the AI model can't load: flood-fill from the image border,
 * removing pixels close to the sampled background colour. Works well for clothes
 * photographed on a plain bed, floor, wall or table.
 */
export async function heuristicRemoveBackground(blob: Blob): Promise<Blob> {
  const bmp = await loadBitmap(blob)
  const { width: w, height: h } = bmp
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data

  // Sample border pixels for the background colour (median per channel)
  const rs: number[] = [], gs: number[] = [], bs: number[] = []
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2])
  }
  for (let x = 0; x < w; x += 4) { sample(x, 0); sample(x, h - 1) }
  for (let y = 0; y < h; y += 4) { sample(0, y); sample(w - 1, y) }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1]
  const br = med(rs), bg = med(gs), bb = med(bs)

  const tol = 34
  const visited = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (p: number) => { if (!visited[p]) { visited[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (stack.length) {
    const p = stack.pop()!
    const i = p * 4
    const dist = Math.max(Math.abs(d[i] - br), Math.abs(d[i + 1] - bg), Math.abs(d[i + 2] - bb))
    if (dist > tol) continue
    d[i + 3] = 0
    const x = p % w, y = (p / w) | 0
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (y > 0) push(p - w)
    if (y < h - 1) push(p + w)
  }
  // Soften the edge: semi-transparent pixels next to removed ones
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (d[p * 4 + 3] === 0) continue
      const n = +(d[(p - 1) * 4 + 3] === 0) + +(d[(p + 1) * 4 + 3] === 0) + +(d[(p - w) * 4 + 3] === 0) + +(d[(p + w) * 4 + 3] === 0)
      if (n) d[p * 4 + 3] = 255 - n * 50
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.convertToBlob({ type: 'image/png' })
}
