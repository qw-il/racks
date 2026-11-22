import { createStore, del, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import type { Calendar, Item, Outfit } from './types'

const db = createStore('racks', 'kv')

interface State {
  ready: boolean
  items: Item[]
  outfits: Outfit[]
  calendar: Calendar
  /** itemId → object URL for its cut-out image */
  images: Record<string, string>
  /** Photos currently being processed (transient, not persisted) */
  uploads: Upload[]
}

export interface Upload {
  id: string
  preview: string
  stage: string
  progress?: number
  error?: string
}

let state: State = { ready: false, items: [], outfits: [], calendar: {}, images: {}, uploads: [] }
const listeners = new Set<() => void>()

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => select(state),
  )
}
export const getState = () => state

async function persist(key: 'items' | 'outfits' | 'calendar') {
  await set(key, state[key], db)
}

export async function init() {
  const [items = [], outfits = [], calendar = {}] = await Promise.all([
    get<Item[]>('items', db),
    get<Outfit[]>('outfits', db),
    get<Calendar>('calendar', db),
  ])
  const images: Record<string, string> = {}
  await Promise.all(
    items.map(async (it) => {
      const b = await get<Blob>(`img:${it.id}`, db)
      if (b) images[it.id] = URL.createObjectURL(b)
    }),
  )
  setState({ ready: true, items, outfits, calendar, images })
}

// ---------- Items ----------
export async function addItem(item: Item, image: Blob) {
  await set(`img:${item.id}`, image, db)
  setState({ items: [item, ...state.items], images: { ...state.images, [item.id]: URL.createObjectURL(image) } })
  await persist('items')
}

export async function updateItem(id: string, patch: Partial<Item>) {
  setState({ items: state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })
  await persist('items')
}

export async function deleteItem(id: string) {
  const images = { ...state.images }
  if (images[id]) URL.revokeObjectURL(images[id])
  delete images[id]
  setState({
    items: state.items.filter((it) => it.id !== id),
    images,
    outfits: state.outfits.map((o) => ({ ...o, placements: o.placements.filter((p) => p.itemId !== id) })),
  })
  await Promise.all([del(`img:${id}`, db), persist('items'), persist('outfits')])
}

// ---------- Outfits ----------
export async function saveOutfit(outfit: Outfit) {
  const exists = state.outfits.some((o) => o.id === outfit.id)
  setState({
    outfits: exists ? state.outfits.map((o) => (o.id === outfit.id ? outfit : o)) : [outfit, ...state.outfits],
  })
  await persist('outfits')
}

export async function deleteOutfit(id: string) {
  const calendar: Calendar = {}
  for (const [d, ids] of Object.entries(state.calendar)) {
    const rest = ids.filter((x) => x !== id)
    if (rest.length) calendar[d] = rest
  }
  setState({ outfits: state.outfits.filter((o) => o.id !== id), calendar })
  await Promise.all([persist('outfits'), persist('calendar')])
}

// ---------- Calendar ----------
export async function scheduleOutfit(date: string, outfitId: string) {
  const cur = state.calendar[date] ?? []
  if (cur.includes(outfitId)) return
  setState({ calendar: { ...state.calendar, [date]: [...cur, outfitId] } })
  await persist('calendar')
}

export async function unscheduleOutfit(date: string, outfitId: string) {
  const rest = (state.calendar[date] ?? []).filter((x) => x !== outfitId)
  const calendar = { ...state.calendar }
  if (rest.length) calendar[date] = rest
  else delete calendar[date]
  setState({ calendar })
  await persist('calendar')
}

/** How many past/today calendar days each item has been scheduled for. */
export function wearCounts(outfits: Outfit[], calendar: Calendar, today: string) {
  const counts: Record<string, number> = {}
  const lastWorn: Record<string, string> = {}
  const byId = new Map(outfits.map((o) => [o.id, o]))
  for (const [date, ids] of Object.entries(calendar)) {
    if (date > today) continue
    const seen = new Set<string>()
    for (const oid of ids) byId.get(oid)?.placements.forEach((p) => seen.add(p.itemId))
    for (const id of seen) {
      counts[id] = (counts[id] ?? 0) + 1
      if (!lastWorn[id] || lastWorn[id] < date) lastWorn[id] = date
    }
  }
  return { counts, lastWorn }
}

/** Random id. crypto.randomUUID only exists in secure contexts (HTTPS/localhost), so fall back for plain-HTTP LAN access. */
export const uid = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Consecutive days (ending today, or yesterday if today isn't logged yet) with an outfit. */
export function streak(calendar: Calendar) {
  const d = new Date()
  if (!calendar[isoDate(d)]?.length) d.setDate(d.getDate() - 1)
  let n = 0
  while (calendar[isoDate(d)]?.length) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}
