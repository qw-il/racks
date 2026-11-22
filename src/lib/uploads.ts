import { isImageFile, processPhoto } from './ai'
import { nameColor } from './color'
import { CLOTHING_TYPES, categoryLabel } from './categories'
import { addItem, getState, setState, uid } from './store'
import type { Item } from './types'

const patchUpload = (id: string, p: Partial<import('./store').Upload>) =>
  setState({ uploads: getState().uploads.map((u) => (u.id === id ? { ...u, ...p } : u)) })

const SINGULAR: Record<string, string> = {
  tops: 'Top',
  bottoms: 'Bottoms',
  dresses: 'Dress',
  outerwear: 'Jacket',
  shoes: 'Shoes',
  bags: 'Bag',
  accessories: 'Accessory',
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export interface ImportCallbacks {
  onAdded?: (item: Item) => void
  /** Called once per session when an AI step falls back, with the reason */
  onFallback?: (reason: string) => void
}

let fallbackReported = false

/**
 * Full pipeline for a new photo: background removal → crop → colour → category,
 * then the item is filed into the wardrobe automatically.
 * Returns how many files were skipped because they weren't images.
 */
export function importPhotos(files: File[], opts: { removeBg: boolean }, cb: ImportCallbacks = {}) {
  const images = files.filter(isImageFile)
  const jobs = images.map((file) => {
    const id = uid()
    setState({ uploads: [...getState().uploads, { id, preview: URL.createObjectURL(file), stage: 'Queued', file }] })
    return { id, file }
  })
  const done = Promise.all(jobs.map(({ id, file }) => runJob(id, file, opts, cb)))
  return { skipped: files.length - images.length, done }
}

async function runJob(id: string, file: File, opts: { removeBg: boolean }, cb: ImportCallbacks) {
  patchUpload(id, { error: undefined, stage: 'Queued', progress: undefined })
  try {
    const res = await processPhoto(file, opts, (stage, progress) => patchUpload(id, { stage, progress }))
    if (res.notes.length && !fallbackReported) {
      fallbackReported = true
      console.warn('[racks]', res.notes.join(' | '))
      cb.onFallback?.(res.notes[0])
    }
    const colorName = nameColor(res.color)
    const type = res.guess?.type ?? 'item'
    const known = type in CLOTHING_TYPES
    const item: Item = {
      id,
      name: known && type.includes(colorName.toLowerCase()) ? titleCase(type) : `${colorName} ${known ? titleCase(type) : SINGULAR[res.guess?.category ?? 'tops']}`,
      category: res.guess?.category ?? 'tops',
      type,
      color: res.color,
      colorName,
      favorite: false,
      createdAt: Date.now(),
      confidence: res.guess?.confidence,
    }
    await addItem(item, res.blob)
    const u = getState().uploads.find((x) => x.id === id)
    if (u) URL.revokeObjectURL(u.preview)
    setState({ uploads: getState().uploads.filter((x) => x.id !== id) })
    cb.onAdded?.(item)
  } catch (e) {
    console.error('[racks] upload failed', e)
    patchUpload(id, { error: e instanceof Error ? e.message : 'Something went wrong', stage: 'Failed' })
  }
}

export function retryUpload(id: string, opts: { removeBg: boolean }, cb: ImportCallbacks = {}) {
  const u = getState().uploads.find((x) => x.id === id)
  if (u?.file) return runJob(id, u.file, opts, cb)
}

export function dismissUpload(id: string) {
  const u = getState().uploads.find((x) => x.id === id)
  if (u) URL.revokeObjectURL(u.preview)
  setState({ uploads: getState().uploads.filter((x) => x.id !== id) })
}

export const describeItem = (it: Item) =>
  `${it.type in CLOTHING_TYPES ? titleCase(it.type) : SINGULAR[it.category]} · ${categoryLabel(it.category)}`
