import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CalendarPlus,
  Check,
  Copy,
  Eraser,
  Layers,
  Minus,
  Plus,
  RotateCw,
  Save,
  Shirt,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DateStrip } from '../components/DateStrip'
import { OutfitPreview } from '../components/OutfitPreview'
import { Button, Empty, Segmented, Sheet, cx, useToast } from '../components/ui'
import { CATEGORIES, LAYER, SLOT } from '../lib/categories'
import { deleteOutfit, isoDate, saveOutfit, scheduleOutfit, uid, useStore } from '../lib/store'
import type { Category, Item, Outfit, Placement } from '../lib/types'

const SINGLE: Category[] = ['bottoms', 'shoes', 'dresses']

export interface BuilderIntent {
  outfitId?: string
  scheduleDate?: string
  nonce: number
}

export function BuilderView({ intent, onDone }: { intent: BuilderIntent | null; onDone: (scheduledDate?: string) => void }) {
  const items = useStore((s) => s.items)
  const images = useStore((s) => s.images)
  const outfits = useStore((s) => s.outfits)
  const toast = useToast()

  const [draftId, setDraftId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [planDate, setPlanDate] = useState(isoDate(new Date()))
  const [dirty, setDirty] = useState(false)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const load = (o: Outfit | null) => {
    setDraftId(o?.id ?? null)
    setName(o?.name ?? '')
    setPlacements(o ? o.placements.filter((p) => byId.has(p.itemId)) : [])
    setSelected(null)
    setDirty(false)
  }

  // Respond to navigation from the calendar ("create outfit for this day" / "edit")
  useEffect(() => {
    if (!intent) return
    load(intent.outfitId ? outfits.find((o) => o.id === intent.outfitId) ?? null : null)
    setScheduleFor(intent.scheduleDate ?? null)
  }, [intent?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (fn: (p: Placement[]) => Placement[]) => {
    setPlacements(fn)
    setDirty(true)
  }

  const add = (it: Item) => {
    update((ps) => {
      if (ps.some((p) => p.itemId === it.id)) return ps.filter((p) => p.itemId !== it.id)
      let rest = ps
      if (SINGLE.includes(it.category)) rest = ps.filter((p) => byId.get(p.itemId)?.category !== it.category)
      if (it.category === 'dresses') rest = rest.filter((p) => byId.get(p.itemId)?.category !== 'bottoms')
      if (it.category === 'bottoms') rest = rest.filter((p) => byId.get(p.itemId)?.category !== 'dresses')
      const slot = SLOT[it.category]
      const same = rest.filter((p) => byId.get(p.itemId)?.category === it.category).length
      return [
        ...rest,
        {
          itemId: it.id,
          x: Math.min(0.85, slot.x + same * 0.08),
          y: Math.min(0.9, slot.y + same * 0.05),
          w: slot.w,
          z: LAYER[it.category] * 10 + same,
          rotate: 0,
        },
      ]
    })
    setSelected(it.id)
  }

  const shuffle = () => {
    const pick = (c: Category) => {
      const pool = items.filter((i) => i.category === c)
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
    }
    const chosen: Item[] = []
    const hasDress = items.some((i) => i.category === 'dresses')
    const hasSeparates = items.some((i) => i.category === 'tops') && items.some((i) => i.category === 'bottoms')
    if (hasDress && (!hasSeparates || Math.random() < 0.3)) chosen.push(pick('dresses')!)
    else {
      const t = pick('tops'), b = pick('bottoms')
      if (t) chosen.push(t)
      if (b) chosen.push(b)
    }
    const s = pick('shoes')
    if (s) chosen.push(s)
    for (const [c, p] of [['outerwear', 0.45], ['bags', 0.4], ['accessories', 0.35]] as const) {
      const x = Math.random() < p ? pick(c) : null
      if (x) chosen.push(x)
    }
    if (!chosen.length) return
    setDraftId(null)
    setName('')
    setSelected(null)
    setDirty(true)
    setPlacements(
      chosen.map((it) => ({ itemId: it.id, ...SLOT[it.category], z: LAYER[it.category] * 10, rotate: 0 })),
    )
  }

  const save = async (asNew = false) => {
    if (!placements.length) return
    const now = Date.now()
    const existing = !asNew && draftId ? outfits.find((o) => o.id === draftId) : undefined
    const o: Outfit = {
      id: existing?.id ?? uid(),
      name: name.trim() || `Look ${outfits.length + 1}`,
      placements,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await saveOutfit(o)
    setDraftId(o.id)
    setName(o.name)
    setDirty(false)
    if (scheduleFor) {
      await scheduleOutfit(scheduleFor, o.id)
      const d = scheduleFor
      setScheduleFor(null)
      toast({ text: `Saved and planned for ${fmtDate(d)}` })
      onDone(d)
    } else {
      toast({ text: `Saved “${o.name}”`, action: { label: 'Plan it', onClick: () => setPlanOpen(true) } })
    }
  }

  const sel = placements.find((p) => p.itemId === selected)
  const patchSel = (p: Partial<Placement>) =>
    update((ps) => ps.map((x) => (x.itemId === selected ? { ...x, ...p } : x)))
  const maxZ = Math.max(0, ...placements.map((p) => p.z))
  const minZ = Math.min(0, ...placements.map((p) => p.z))

  const pickerItems = items.filter((i) => cat === 'all' || i.category === cat)
  const catOptions = [
    { id: 'all' as const, label: 'All' },
    ...CATEGORIES.filter((c) => items.some((i) => i.category === c.id)).map((c) => ({ id: c.id, label: c.label })),
  ]

  if (!items.length) {
    return (
      <div>
        <Title />
        <Empty
          icon={<Layers size={28} />}
          title="Nothing to style yet"
          body="Add a few pieces to your wardrobe first, then come back to mix and match them into outfits."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Title />
        <div className="flex items-center gap-2">
          <Button onClick={shuffle}>
            <Shuffle size={16} /> Shuffle
          </Button>
          <Button variant="ghost" onClick={() => load(null)} disabled={!placements.length && !draftId}>
            <Eraser size={16} /> New
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {scheduleFor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                <CalendarPlus size={16} /> Building an outfit for <b>{fmtDate(scheduleFor)}</b>
              </span>
              <button onClick={() => setScheduleFor(null)} className="text-ink-2 hover:text-ink cursor-pointer" aria-label="Cancel">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] items-start">
        {/* ---- Canvas ---- */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => (setName(e.target.value), setDirty(true))}
              placeholder={draftId ? 'Untitled look' : 'Name this look…'}
              className="flex-1 min-w-0 bg-transparent font-display text-3xl outline-none placeholder:text-ink-3"
            />
            {draftId && dirty && (
              <Button size="sm" variant="ghost" onClick={() => save(true)} title="Save as a copy">
                <Copy size={14} />
              </Button>
            )}
            <Button variant="primary" onClick={() => save()} disabled={!placements.length || (!dirty && !!draftId && !scheduleFor)}>
              {draftId && !dirty ? <Check size={16} /> : <Save size={16} />}
              {draftId && !dirty ? 'Saved' : scheduleFor ? 'Save & plan' : 'Save'}
            </Button>
          </div>

          <Canvas
            placements={placements}
            images={images}
            selected={selected}
            onSelect={setSelected}
            onChange={update}
            maxZ={maxZ}
          />

          <div className="h-12">
            <AnimatePresence mode="wait">
              {sel ? (
                <motion.div
                  key="tools"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="flex items-center justify-center gap-1 rounded-full bg-surface shadow-soft p-1 w-fit mx-auto"
                >
                  <Tool label="Smaller" onClick={() => patchSel({ w: Math.max(0.08, sel.w - 0.04) })}><Minus size={16} /></Tool>
                  <Tool label="Larger" onClick={() => patchSel({ w: Math.min(1, sel.w + 0.04) })}><Plus size={16} /></Tool>
                  <Tool label="Rotate" onClick={() => patchSel({ rotate: (sel.rotate + 15) % 360 })}><RotateCw size={16} /></Tool>
                  <Tool label="Bring forward" onClick={() => patchSel({ z: maxZ + 1 })}><ArrowUpToLine size={16} /></Tool>
                  <Tool label="Send back" onClick={() => patchSel({ z: minZ - 1 })}><ArrowDownToLine size={16} /></Tool>
                  <span className="w-px h-5 bg-line mx-1" />
                  <Tool label="Remove" danger onClick={() => (update((ps) => ps.filter((p) => p.itemId !== selected)), setSelected(null))}>
                    <Trash2 size={16} />
                  </Tool>
                </motion.div>
              ) : (
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-xs text-ink-3 pt-3">
                  {placements.length ? 'Drag pieces to arrange · tap one to resize, rotate or layer' : 'Tap pieces to drop them on the board'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ---- Picker ---- */}
        <div className="flex flex-col gap-3 min-w-0">
          <Segmented id="builder-cat" options={catOptions} value={cat} onChange={setCat} />
          <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            <AnimatePresence mode="popLayout">
              {pickerItems.map((it) => {
                const on = placements.some((p) => p.itemId === it.id)
                return (
                  <motion.button
                    key={it.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => add(it)}
                    className={cx(
                      'relative aspect-square rounded-2xl bg-check grid place-items-center cursor-pointer ring-2 transition-[box-shadow]',
                      on ? 'ring-ink' : 'ring-transparent hover:ring-line',
                    )}
                    title={it.name}
                  >
                    {images[it.id] && <img src={images[it.id]} alt={it.name} draggable={false} className="absolute inset-0 m-auto h-[76%] w-[76%] object-contain cutout" />}
                    <AnimatePresence>
                      {on && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-bg"
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* ---- Saved outfits ---- */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-3xl">Saved looks</h2>
          <span className="text-sm text-ink-3">{outfits.length}</span>
        </div>
        {outfits.length === 0 ? (
          <p className="text-sm text-ink-3 py-6">Looks you save will appear here.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <AnimatePresence mode="popLayout">
              {outfits.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cx(
                    'group relative rounded-3xl bg-surface shadow-soft overflow-hidden ring-2 transition-[box-shadow]',
                    o.id === draftId ? 'ring-ink' : 'ring-transparent',
                  )}
                >
                  <button
                    onClick={() => (load(o), window.scrollTo({ top: 0, behavior: 'smooth' }))}
                    className="block w-full text-left cursor-pointer"
                  >
                    <OutfitPreview placements={o.placements} className="bg-check" />
                    <div className="px-3 py-2.5">
                      <div className="truncate text-sm font-medium">{o.name}</div>
                      <div className="text-xs text-ink-3">{o.placements.length} pieces</div>
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => (setDraftId(o.id), setPlanOpen(true))}
                      className="grid h-8 w-8 place-items-center rounded-full bg-surface/90 backdrop-blur cursor-pointer hover:bg-surface"
                      aria-label="Plan on calendar"
                    >
                      <CalendarPlus size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (o.id === draftId) load(null)
                        deleteOutfit(o.id)
                        toast({ text: `Deleted “${o.name}”`, action: { label: 'Undo', onClick: () => saveOutfit(o) } })
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full bg-surface/90 backdrop-blur cursor-pointer hover:bg-surface text-danger"
                      aria-label="Delete look"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plan this look">
        <div className="flex flex-col gap-5">
          <DateStrip value={planDate} onChange={setPlanDate} />
          <Button
            variant="primary"
            className="h-12"
            onClick={async () => {
              if (!draftId) return
              await scheduleOutfit(planDate, draftId)
              setPlanOpen(false)
              toast({ text: `Planned for ${fmtDate(planDate)}`, action: { label: 'View', onClick: () => onDone(planDate) } })
            }}
          >
            <CalendarPlus size={17} /> Add to {fmtDate(planDate)}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function Title() {
  return (
    <div>
      <p className="text-ink-3 text-sm">Mix &amp; match</p>
      <h1 className="font-display text-5xl md:text-6xl leading-none tracking-tight">Outfit builder</h1>
    </div>
  )
}

function Tool({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        'grid h-9 w-9 place-items-center rounded-full transition-colors cursor-pointer active:scale-90',
        danger ? 'text-danger hover:bg-danger/10' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/** The mood-board: free-form drag, with pointer capture so it works for mouse, pen and touch. */
function Canvas({
  placements,
  images,
  selected,
  onSelect,
  onChange,
  maxZ,
}: {
  placements: Placement[]
  images: Record<string, string>
  selected: string | null
  onSelect: (id: string | null) => void
  onChange: (fn: (p: Placement[]) => Placement[]) => void
  maxZ: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const pinch = useRef<{ dist: number; w: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const onDown = (e: React.PointerEvent, p: Placement) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), w: p.w }
      return
    }
    drag.current = { id: p.itemId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false }
    onSelect(p.itemId)
    if (p.z < maxZ) onChange((ps) => ps.map((x) => (x.itemId === p.itemId ? { ...x, z: maxZ + 1 } : x)))
  }

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = ref.current!.getBoundingClientRect()
    if (pinch.current && pointers.current.size === 2 && drag.current) {
      const [a, b] = [...pointers.current.values()]
      const s = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist
      const w = Math.max(0.08, Math.min(1, pinch.current.w * s))
      const id = drag.current.id
      onChange((ps) => ps.map((x) => (x.itemId === id ? { ...x, w } : x)))
      return
    }
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / rect.width
    const dy = (e.clientY - d.sy) / rect.height
    if (Math.abs(dx) + Math.abs(dy) > 0.004) d.moved = true
    const x = Math.max(0.02, Math.min(0.98, d.ox + dx))
    const y = Math.max(0.02, Math.min(0.98, d.oy + dy))
    onChange((ps) => ps.map((p) => (p.itemId === d.id ? { ...p, x, y } : p)))
  }

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const onWheel = (e: React.WheelEvent, p: Placement) => {
    if (selected !== p.itemId) return
    const w = Math.max(0.08, Math.min(1, p.w * (e.deltaY < 0 ? 1.05 : 0.95)))
    onChange((ps) => ps.map((x) => (x.itemId === p.itemId ? { ...x, w } : x)))
  }

  return (
    <div
      ref={ref}
      onPointerDown={() => onSelect(null)}
      className="relative isolate aspect-[3/4] w-full max-w-[calc(60dvh*0.75)] lg:max-w-none mx-auto rounded-[32px] bg-check overflow-hidden shadow-soft touch-none select-none"
    >
      {placements.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-ink-3">
          <div className="text-center">
            <Shirt size={34} className="mx-auto opacity-50" />
            <p className="mt-2 text-sm">Your look starts here</p>
          </div>
        </div>
      )}
      <AnimatePresence>
        {placements.map((p) =>
          images[p.itemId] ? (
            <div
              key={p.itemId}
              className="absolute"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.w * 100}%`,
                zIndex: p.z + 100,
                transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
                transition: drag.current?.id === p.itemId ? 'none' : 'transform 300ms cubic-bezier(.2,.8,.2,1), width 200ms ease',
              }}
            >
              <motion.img
                src={images[p.itemId]}
                alt=""
                draggable={false}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                onPointerDown={(e) => onDown(e, p)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onWheel={(e) => onWheel(e, p)}
                className={cx(
                  'block w-full cutout cursor-grab active:cursor-grabbing rounded-xl',
                  selected === p.itemId && 'outline-2 outline-dashed outline-offset-4 outline-ink/40',
                )}
              />
            </div>
          ) : null,
        )}
      </AnimatePresence>
    </div>
  )
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = isoDate(new Date())
  const t = new Date()
  t.setDate(t.getDate() + 1)
  if (iso === today) return 'today'
  if (iso === isoDate(t)) return 'tomorrow'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
