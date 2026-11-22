import { processPhoto } from './ai'
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

/**
 * Full pipeline for a new photo: background removal → crop → colour → category,
 * then the item is filed into the wardrobe automatically.
 */
export async function importPhotos(
  files: File[],
  opts: { removeBg: boolean },
  onAdded?: (item: Item) => void,
) {
  const jobs = files
    .filter((f) => f.type.startsWith('image/'))
    .map((file) => {
      const id = uid()
      setState({ uploads: [...getState().uploads, { id, preview: URL.createObjectURL(file), stage: 'Queued' }] })
      return { id, file }
    })

  await Promise.all(
    jobs.map(async ({ id, file }) => {
      try {
        const res = await processPhoto(file, opts, (stage, progress) => patchUpload(id, { stage, progress }))
        const colorName = nameColor(res.color)
        const type = res.guess?.type ?? 'item'
        const known = type in CLOTHING_TYPES
        const item: Item = {
          id,
          name: `${colorName} ${known ? titleCase(type) : SINGULAR[res.guess?.category ?? 'tops']}`,
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
        onAdded?.(item)
      } catch (e) {
        patchUpload(id, { error: e instanceof Error ? e.message : 'Something went wrong', stage: 'Failed' })
      }
    }),
  )
}

export function dismissUpload(id: string) {
  const u = getState().uploads.find((x) => x.id === id)
  if (u) URL.revokeObjectURL(u.preview)
  setState({ uploads: getState().uploads.filter((x) => x.id !== id) })
}

export const describeItem = (it: Item) =>
  `${it.type in CLOTHING_TYPES ? titleCase(it.type) : SINGULAR[it.category]} · ${categoryLabel(it.category)}`
