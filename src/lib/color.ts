const NAMED: [string, [number, number, number]][] = [
  ['Black', [20, 20, 22]],
  ['Charcoal', [64, 64, 68]],
  ['Grey', [128, 128, 132]],
  ['Silver', [190, 190, 195]],
  ['White', [245, 245, 242]],
  ['Cream', [240, 230, 205]],
  ['Beige', [214, 192, 160]],
  ['Tan', [190, 150, 105]],
  ['Brown', [110, 72, 45]],
  ['Camel', [176, 128, 72]],
  ['Red', [200, 35, 40]],
  ['Burgundy', [110, 25, 40]],
  ['Pink', [240, 160, 180]],
  ['Coral', [245, 120, 100]],
  ['Orange', [240, 130, 40]],
  ['Mustard', [215, 170, 45]],
  ['Yellow', [245, 220, 60]],
  ['Olive', [110, 115, 50]],
  ['Green', [50, 140, 70]],
  ['Forest', [30, 75, 45]],
  ['Mint', [170, 225, 195]],
  ['Teal', [30, 125, 125]],
  ['Sky', [140, 195, 235]],
  ['Blue', [45, 95, 200]],
  ['Denim', [75, 105, 150]],
  ['Navy', [25, 35, 75]],
  ['Lavender', [190, 170, 225]],
  ['Purple', [110, 55, 150]],
]

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function nameColor(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  let best = NAMED[0][0]
  let bestD = Infinity
  for (const [name, [R, G, B]] of NAMED) {
    // weighted euclidean ("redmean") distance — cheap perceptual approximation
    const rm = (r + R) / 2
    const d = (2 + rm / 256) * (r - R) ** 2 + 4 * (g - G) ** 2 + (2 + (255 - rm) / 256) * (b - B) ** 2
    if (d < bestD) {
      bestD = d
      best = name
    }
  }
  return best
}

/** Dominant colour of the opaque pixels of an RGBA buffer (simple histogram quantisation). */
export function dominantColor(data: Uint8ClampedArray): string {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 200) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = buckets.get(key)
    if (e) {
      e.n++; e.r += r; e.g += g; e.b += b
    } else buckets.set(key, { n: 1, r, g, b })
  }
  let top: { n: number; r: number; g: number; b: number } | undefined
  for (const e of buckets.values()) if (!top || e.n > top.n) top = e
  if (!top) return '#888888'
  return rgbToHex(top.r / top.n, top.g / top.n, top.b / top.n)
}
