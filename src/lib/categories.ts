import type { Category } from './types'

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'tops', label: 'Tops', emoji: '👕' },
  { id: 'bottoms', label: 'Bottoms', emoji: '👖' },
  { id: 'dresses', label: 'Dresses', emoji: '👗' },
  { id: 'outerwear', label: 'Outerwear', emoji: '🧥' },
  { id: 'shoes', label: 'Shoes', emoji: '👟' },
  { id: 'bags', label: 'Bags', emoji: '👜' },
  { id: 'accessories', label: 'Accessories', emoji: '🧢' },
]

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? c

/** Zero-shot labels the classifier chooses between, and the category each maps to. */
export const CLOTHING_TYPES: Record<string, Category> = {
  't-shirt': 'tops',
  'button-up shirt': 'tops',
  blouse: 'tops',
  'polo shirt': 'tops',
  sweater: 'tops',
  hoodie: 'tops',
  sweatshirt: 'tops',
  'tank top': 'tops',
  cardigan: 'tops',
  jeans: 'bottoms',
  trousers: 'bottoms',
  shorts: 'bottoms',
  skirt: 'bottoms',
  leggings: 'bottoms',
  'sweatpants': 'bottoms',
  dress: 'dresses',
  jumpsuit: 'dresses',
  jacket: 'outerwear',
  coat: 'outerwear',
  blazer: 'outerwear',
  'puffer jacket': 'outerwear',
  'denim jacket': 'outerwear',
  sneakers: 'shoes',
  boots: 'shoes',
  sandals: 'shoes',
  'high heels': 'shoes',
  loafers: 'shoes',
  'dress shoes': 'shoes',
  handbag: 'bags',
  backpack: 'bags',
  'tote bag': 'bags',
  hat: 'accessories',
  cap: 'accessories',
  scarf: 'accessories',
  belt: 'accessories',
  sunglasses: 'accessories',
  watch: 'accessories',
  necklace: 'accessories',
  tie: 'accessories',
  socks: 'accessories',
}

/** Default layout slot in the outfit builder for each category (fractions of the canvas). */
export const SLOT: Record<Category, { x: number; y: number; w: number }> = {
  outerwear: { x: 0.3, y: 0.3, w: 0.42 },
  tops: { x: 0.55, y: 0.28, w: 0.4 },
  dresses: { x: 0.5, y: 0.42, w: 0.42 },
  bottoms: { x: 0.5, y: 0.62, w: 0.36 },
  shoes: { x: 0.5, y: 0.88, w: 0.28 },
  bags: { x: 0.82, y: 0.6, w: 0.26 },
  accessories: { x: 0.18, y: 0.72, w: 0.2 },
}

export const LAYER: Record<Category, number> = {
  bottoms: 1,
  dresses: 2,
  tops: 3,
  outerwear: 4,
  shoes: 5,
  bags: 6,
  accessories: 7,
}
