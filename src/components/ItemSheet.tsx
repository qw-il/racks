import { Heart, Shirt, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, CLOTHING_TYPES } from '../lib/categories'
import { nameColor } from '../lib/color'
import { deleteItem, updateItem, useStore } from '../lib/store'
import type { Category } from '../lib/types'
import { Button, Sheet, cx, useToast } from './ui'

export function ItemSheet({ id, onClose, wornCount }: { id: string | null; onClose: () => void; wornCount: number }) {
  const current = useStore((s) => s.items.find((i) => i.id === id))
  // Keep showing the last item while the sheet animates closed
  const last = useRef(current)
  if (current) last.current = current
  const item = current ?? last.current
  const image = useStore((s) => (item ? s.images[item.id] : undefined))
  const outfitCount = useStore((s) => (id ? s.outfits.filter((o) => o.placements.some((p) => p.itemId === id)).length : 0))
  const toast = useToast()
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (item) setName(item.name)
    setConfirm(false)
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const typesFor = (c: Category) => Object.entries(CLOTHING_TYPES).filter(([, cat]) => cat === c).map(([t]) => t)

  return (
    <Sheet open={!!current} onClose={onClose} title="Edit piece">
      {item && (
        <div className="flex flex-col gap-5">
          <div className="relative aspect-[4/3] max-h-[42vh] w-full rounded-3xl bg-check grid place-items-center overflow-hidden">
            {image && <img src={image} alt={item.name} className="absolute inset-0 m-auto h-[78%] w-[78%] object-contain cutout" />}
            <button
              onClick={() => updateItem(item.id, { favorite: !item.favorite })}
              className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-surface/90 backdrop-blur cursor-pointer active:scale-90 transition"
              aria-label="Toggle favourite"
            >
              <Heart size={18} className={cx(item.favorite && 'fill-danger text-danger')} />
            </button>
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              <span className="rounded-full bg-surface/90 backdrop-blur px-2.5 py-1 text-xs">Worn {wornCount}×</span>
              <span className="rounded-full bg-surface/90 backdrop-blur px-2.5 py-1 text-xs">In {outfitCount} outfit{outfitCount === 1 ? '' : 's'}</span>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-3 uppercase tracking-wide">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && updateItem(item.id, { name: name.trim() })}
              className="h-11 rounded-2xl bg-surface-2 px-4 text-[15px] outline-none focus:ring-2 focus:ring-ink/20"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-3 uppercase tracking-wide">
              Category
              {item.confidence != null && item.confidence < 1 && (
                <span className="normal-case tracking-normal font-normal">
                  {' '}· {item.confidence === 0 ? 'guessed from shape — please check' : `auto-detected (${Math.round(item.confidence * 100)}% sure)`}
                </span>
              )}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    updateItem(item.id, {
                      category: c.id,
                      type: CLOTHING_TYPES[item.type] === c.id ? item.type : typesFor(c.id)[0],
                      confidence: 1,
                    })
                  }
                  className={cx(
                    'h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors cursor-pointer',
                    item.category === c.id ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2 hover:text-ink',
                  )}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-3 uppercase tracking-wide">Type</span>
            <div className="flex flex-wrap gap-1.5">
              {typesFor(item.category).map((t) => (
                <button
                  key={t}
                  onClick={() => updateItem(item.id, { type: t })}
                  className={cx(
                    'h-8 rounded-full px-3 text-[13px] capitalize transition-colors cursor-pointer ring-1',
                    item.type === t ? 'ring-ink bg-ink/5 font-medium' : 'ring-line text-ink-2 hover:text-ink',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <div>
              <div className="text-xs font-medium text-ink-3 uppercase tracking-wide">Colour</div>
              <div className="text-[15px] mt-0.5">{item.colorName}</div>
            </div>
            <input
              type="color"
              value={item.color}
              onChange={(e) => updateItem(item.id, { color: e.target.value, colorName: nameColor(e.target.value) })}
              className="h-10 w-10 cursor-pointer ring-1 ring-line rounded-full"
              aria-label="Pick colour"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-ink-3 flex items-center gap-1.5">
              <Shirt size={13} /> Added {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!confirm) return setConfirm(true)
                const n = item.name
                onClose()
                await deleteItem(item.id)
                toast({ text: `Removed ${n}` })
              }}
            >
              <Trash2 size={14} /> {confirm ? 'Tap again to delete' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
