import { LAYER, SLOT } from './categories'
import type { Category, Item, Placement } from './types'

const NEUTRALS = new Set(['Black', 'Charcoal', 'Grey', 'Silver', 'White', 'Cream', 'Beige', 'Tan', 'Brown', 'Camel', 'Denim', 'Navy'])
export const isNeutral = (it: Item) => NEUTRALS.has(it.colorName)

/** Weighted pick that favours pieces you haven't worn much. */
function pick(items: Item[], c: Category, worn: Record<string, number>, exclude?: Set<string>) {
  const pool = items.filter((i) => i.category === c && !exclude?.has(i.id))
  if (!pool.length) return null
  const weights = pool.map((i) => 1 / (1 + (worn[i.id] ?? 0)))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let k = 0; k < pool.length; k++) if ((r -= weights[k]) <= 0) return pool[k]
  return pool[pool.length - 1]
}

function candidate(items: Item[], worn: Record<string, number>, exclude?: Set<string>): Item[] {
  const chosen: Item[] = []
  const hasDress = items.some((i) => i.category === 'dresses')
  const hasSeparates = items.some((i) => i.category === 'tops') && items.some((i) => i.category === 'bottoms')
  if (hasDress && (!hasSeparates || Math.random() < 0.3)) chosen.push(pick(items, 'dresses', worn, exclude)!)
  else {
    const t = pick(items, 'tops', worn, exclude) ?? pick(items, 'tops', worn)
    const b = pick(items, 'bottoms', worn, exclude) ?? pick(items, 'bottoms', worn)
    if (t) chosen.push(t)
    if (b) chosen.push(b)
  }
  const s = pick(items, 'shoes', worn)
  if (s) chosen.push(s)
  for (const [c, p] of [['outerwear', 0.45], ['bags', 0.4], ['accessories', 0.35]] as const) {
    const x = Math.random() < p ? pick(items, c, worn) : null
    if (x) chosen.push(x)
  }
  return chosen
}

/** Score: reward at least one neutral anchor, punish clashing brights. */
function score(look: Item[]) {
  const brights = look.filter((i) => !isNeutral(i))
  const distinctBrights = new Set(brights.map((i) => i.colorName)).size
  return (look.some(isNeutral) ? 2 : 0) - Math.max(0, distinctBrights - 1) * 1.5 + look.length * 0.2 + Math.random()
}

/** Generate a styled outfit suggestion — best of a handful of random candidates. */
export function suggestOutfit(items: Item[], worn: Record<string, number> = {}, avoid?: Set<string>): Item[] {
  let best: Item[] = []
  let bestScore = -Infinity
  for (let i = 0; i < 10; i++) {
    const c = candidate(items, worn, avoid)
    const s = score(c)
    if (c.length && s > bestScore) {
      best = c
      bestScore = s
    }
  }
  return best
}

export function layoutFor(items: Item[]): Placement[] {
  const seen: Partial<Record<Category, number>> = {}
  return items.map((it) => {
    const n = (seen[it.category] = (seen[it.category] ?? -1) + 1)
    const slot = SLOT[it.category]
    return { itemId: it.id, x: Math.min(0.85, slot.x + n * 0.08), y: Math.min(0.9, slot.y + n * 0.05), w: slot.w, z: LAYER[it.category] * 10 + n, rotate: 0 }
  })
}

export const BACKDROPS: { id: string; label: string; css: string }[] = [
  { id: 'dots', label: 'Studio', css: '' },
  { id: 'blush', label: 'Blush', css: 'linear-gradient(160deg,#fbe9df 0%,#f3c6a5 100%)' },
  { id: 'sage', label: 'Sage', css: 'linear-gradient(160deg,#eef2ea 0%,#bccdb2 100%)' },
  { id: 'sky', label: 'Sky', css: 'linear-gradient(160deg,#e8f0f8 0%,#b3c8e2 100%)' },
  { id: 'lilac', label: 'Lilac', css: 'linear-gradient(160deg,#f1ebf7 0%,#c9b6e2 100%)' },
  { id: 'sun', label: 'Sun', css: 'linear-gradient(160deg,#fdf3d8 0%,#f2cf7a 100%)' },
  { id: 'night', label: 'Night', css: 'radial-gradient(120% 90% at 30% 10%,#3b3842 0%,#16151a 100%)' },
]
export const backdropStyle = (id?: string): React.CSSProperties | undefined => {
  const b = BACKDROPS.find((x) => x.id === id)
  return b?.css ? { background: b.css } : undefined
}
