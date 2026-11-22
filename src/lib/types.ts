export type Category =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'bags'
  | 'accessories'

export interface Item {
  id: string
  name: string
  category: Category
  /** Fine-grained type, e.g. "t-shirt", "sneakers" */
  type: string
  color: string // hex
  colorName: string
  favorite: boolean
  createdAt: number
  /** Confidence (0–1) of the automatic categorisation, if any */
  confidence?: number
}

export interface Placement {
  itemId: string
  /** Position as a fraction of the canvas (0–1) of the item's centre */
  x: number
  y: number
  /** Width as a fraction of canvas width */
  w: number
  z: number
  rotate: number
}

export interface Outfit {
  id: string
  name: string
  placements: Placement[]
  /** Backdrop id from BACKDROPS */
  backdrop?: string
  createdAt: number
  updatedAt: number
}

/** ISO date (YYYY-MM-DD) → outfit ids */
export type Calendar = Record<string, string[]>
