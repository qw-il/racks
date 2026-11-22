import { nameColor } from './color'
import { trimAndAnalyse } from './image'
import { addItem, isoDate, saveOutfit, scheduleOutfit, uid } from './store'
import { layoutFor } from './suggest'
import type { Category, Item } from './types'

// Simple flat-lay illustrations (viewBox 0 0 400 500) so new users can play straight away.
const SHAPES: Record<string, { body: string; details?: string }> = {
  tshirt: {
    body: 'M120 60 L162 40 Q200 72 238 40 L280 60 L362 132 L322 182 L292 156 L292 462 L108 462 L108 156 L78 182 L38 132 Z',
    details: 'M162 40 Q200 80 238 40 M108 440 L292 440',
  },
  sweater: {
    body: 'M125 55 L165 40 Q200 62 235 40 L275 55 Q330 80 345 160 L372 400 L326 412 L296 210 L296 450 L104 450 L104 210 L74 412 L28 400 L55 160 Q70 80 125 55 Z',
    details: 'M104 425 L296 425 M40 380 L80 388 M360 380 L320 388 M165 40 Q200 74 235 40',
  },
  jacket: {
    body: 'M125 55 L170 38 L200 70 L230 38 L275 55 Q330 80 345 160 L372 390 L326 402 L298 220 L298 430 L102 430 L102 220 L74 402 L28 390 L55 160 Q70 80 125 55 Z',
    details: 'M200 70 L200 430 M170 38 L150 120 L200 70 M230 38 L250 120 L200 70 M130 250 L170 250 M230 250 L270 250 M102 405 L298 405',
  },
  coat: {
    body: 'M125 45 L170 30 L200 60 L230 30 L275 45 Q330 70 345 150 L372 400 L326 412 L300 200 L312 485 L88 485 L100 200 L74 412 L28 400 L55 150 Q70 70 125 45 Z',
    details: 'M200 60 L200 485 M170 30 L140 150 L200 60 M230 30 L260 150 L200 60 M115 300 L170 300 M230 300 L285 300',
  },
  jeans: {
    body: 'M118 36 L282 36 L304 472 L218 472 L200 176 L182 472 L96 472 Z',
    details: 'M118 62 L282 62 M200 62 L200 150 M128 62 Q150 110 190 100 M272 62 Q250 110 210 100',
  },
  skirt: { body: 'M140 60 L260 60 L332 420 Q200 452 68 420 Z', details: 'M140 88 L260 88 M200 88 L186 432 M200 88 L230 430' },
  dress: {
    body: 'M158 36 L178 36 Q200 70 222 36 L242 36 L252 160 Q246 200 272 232 L344 470 Q200 492 56 470 L128 232 Q154 200 148 160 Z',
    details: 'M150 200 Q200 220 250 200',
  },
  sneaker: {
    body: 'M40 330 Q38 272 92 262 L172 252 Q204 196 252 214 L306 240 Q364 262 366 322 L366 352 L40 352 Z',
    details: 'M196 222 L182 262 M214 226 L200 266 M232 232 L218 270 M40 352 L366 352',
  },
  boot: {
    body: 'M122 70 L232 70 L238 300 Q332 312 352 362 L352 410 L112 410 Z',
    details: 'M112 382 L352 382 M122 100 L232 100 M232 150 L250 150',
  },
  tote: {
    body: 'M88 200 L312 200 L334 462 L66 462 Z',
    details: 'M140 200 Q140 86 200 86 Q260 86 260 200',
  },
  cap: {
    body: 'M86 302 Q86 160 218 160 Q342 160 342 302 Z M300 286 Q394 284 392 318 L300 322 Z',
    details: 'M218 160 L218 302 M150 175 Q170 240 160 302 M286 175 Q266 240 276 302',
  },
}

const SAMPLES: { shape: keyof typeof SHAPES; color: string; category: Category; type: string; name?: string }[] = [
  { shape: 'tshirt', color: '#f4f2ee', category: 'tops', type: 't-shirt' },
  { shape: 'tshirt', color: '#2f3b63', category: 'tops', type: 't-shirt' },
  { shape: 'sweater', color: '#d9c3a0', category: 'tops', type: 'sweater' },
  { shape: 'sweater', color: '#5f7a5a', category: 'tops', type: 'sweater' },
  { shape: 'jeans', color: '#4b6a96', category: 'bottoms', type: 'jeans' },
  { shape: 'jeans', color: '#c8b08a', category: 'bottoms', type: 'trousers' },
  { shape: 'skirt', color: '#222126', category: 'bottoms', type: 'skirt' },
  { shape: 'dress', color: '#b8323f', category: 'dresses', type: 'dress' },
  { shape: 'jacket', color: '#5d7fa8', category: 'outerwear', type: 'denim jacket' },
  { shape: 'coat', color: '#b58450', category: 'outerwear', type: 'coat' },
  { shape: 'sneaker', color: '#f6f6f4', category: 'shoes', type: 'sneakers' },
  { shape: 'boot', color: '#2a2422', category: 'shoes', type: 'boots' },
  { shape: 'tote', color: '#c99a66', category: 'bags', type: 'tote bag' },
  { shape: 'cap', color: '#e0a83a', category: 'accessories', type: 'cap' },
]

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt))).toString(16).padStart(2, '0')
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255)
}

function svgFor(shape: keyof typeof SHAPES, color: string) {
  const s = SHAPES[shape]
  const light = parseInt(color.slice(1, 3), 16) > 200
  const stroke = shade(color, light ? -38 : -30)
  const handle = shape === 'tote'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="800" height="1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>
  ${handle ? `<path d="${s.details}" fill="none" stroke="${shade(color, -45)}" stroke-width="16" stroke-linecap="round"/>` : ''}
  <path d="${s.body}" fill="${color}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  <path d="${s.body}" fill="url(#g)"/>
  ${!handle && s.details ? `<path d="${s.details}" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round" opacity=".8"/>` : ''}
  ${shape === 'sneaker' ? `<rect x="36" y="350" width="334" height="26" rx="10" fill="${shade(color, -22)}"/>` : ''}
  ${shape === 'boot' ? `<rect x="108" y="408" width="248" height="22" rx="6" fill="#141212"/>` : ''}
</svg>`
}

async function rasterise(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 800
    c.height = 1000
    c.getContext('2d')!.drawImage(img, 0, 0, 800, 1000)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
    return (await trimAndAnalyse(blob)).blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/** Fill the wardrobe with illustrated sample pieces, two looks and a little calendar history. */
export async function loadSampleWardrobe() {
  const now = Date.now()
  const items: Item[] = []
  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i]
    const colorName = nameColor(s.color)
    const item: Item = {
      id: uid(),
      name: s.type.includes(colorName.toLowerCase()) ? title(s.type) : `${colorName} ${title(s.type)}`,
      category: s.category,
      type: s.type,
      color: s.color,
      colorName,
      favorite: i === 9,
      createdAt: now - i * 1000,
      confidence: 1,
    }
    await addItem(item, await rasterise(svgFor(s.shape, s.color)))
    items.push(item)
  }
  const byType = (t: string, c?: string) => items.find((i) => i.type === t && (!c || i.color === c))!
  const looks = [
    { name: 'Easy Saturday', backdrop: 'sky', pieces: [byType('t-shirt', '#f4f2ee'), byType('jeans'), byType('sneakers'), byType('denim jacket')] },
    { name: 'Dinner date', backdrop: 'blush', pieces: [byType('dress'), byType('boots'), byType('tote bag')] },
    { name: 'Autumn layers', backdrop: 'sun', pieces: [byType('sweater', '#d9c3a0'), byType('trousers'), byType('coat'), byType('boots')] },
  ]
  const ids: string[] = []
  for (const [k, l] of looks.entries()) {
    const id = uid()
    ids.push(id)
    await saveOutfit({ id, name: l.name, backdrop: l.backdrop, placements: layoutFor(l.pieces), createdAt: now - k, updatedAt: now - k })
  }
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return isoDate(d)
  }
  await scheduleOutfit(day(-3), ids[0])
  await scheduleOutfit(day(-2), ids[2])
  await scheduleOutfit(day(-1), ids[1])
  await scheduleOutfit(day(2), ids[2])
}
