import { AnimatePresence, motion } from 'motion/react'
import { Camera, Heart, ImagePlus, Search, Shirt, Sparkles, Wand2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { ItemCard } from '../components/ItemCard'
import { ItemSheet } from '../components/ItemSheet'
import { Button, Empty, Segmented, cx, useToast } from '../components/ui'
import { CATEGORIES } from '../lib/categories'
import { isoDate, useStore, wearCounts } from '../lib/store'
import type { Category, Item } from '../lib/types'
import { loadSampleWardrobe } from '../lib/samples'
import { describeItem, dismissUpload, importPhotos } from '../lib/uploads'

type Filter = Category | 'all' | 'favorites'
type Sort = 'recent' | 'most' | 'least'

export function WardrobeView() {
  const items = useStore((s) => s.items)
  const images = useStore((s) => s.images)
  const uploads = useStore((s) => s.uploads)
  const calendar = useStore((s) => s.calendar)
  const outfits = useStore((s) => s.outfits)
  const toast = useToast()

  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [removeBg, setRemoveBg] = useState(() => localStorage.getItem('racks.removeBg') !== '0')
  const mountedAt = useRef(Date.now())
  const [loadingSamples, setLoadingSamples] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const { counts } = useMemo(() => wearCounts(outfits, calendar, isoDate(new Date())), [calendar, outfits])

  const counted = useMemo(() => {
    const c: Record<string, number> = { all: items.length, favorites: items.filter((i) => i.favorite).length }
    for (const it of items) c[it.category] = (c[it.category] ?? 0) + 1
    return c
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((it) =>
      filter === 'all' ? true : filter === 'favorites' ? it.favorite : it.category === filter,
    )
    if (q) list = list.filter((it) => `${it.name} ${it.type} ${it.colorName} ${it.category}`.toLowerCase().includes(q))
    if (sort === 'most') list = [...list].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    if (sort === 'least') list = [...list].sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0))
    return list
  }, [items, filter, query, sort, counts])

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const list = [...files]
    if (list.length === 1) {
      importPhotos(list, { removeBg }, (item: Item) =>
        toast({
          text: (
            <>
              Added <b className="font-semibold">{item.name}</b> to {describeItem(item).split(' · ')[1]}
            </>
          ),
          action: { label: 'Edit', onClick: () => setOpenId(item.id) },
        }),
      )
    } else {
      let added = 0
      await importPhotos(list, { removeBg }, () => added++)
      if (added) toast({ text: `Added ${added} pieces and sorted them into categories` })
    }
  }

  const toggleBg = () => {
    setRemoveBg((v) => {
      localStorage.setItem('racks.removeBg', v ? '0' : '1')
      return !v
    })
  }

  const filterOptions: { id: Filter; label: React.ReactNode }[] = [
    { id: 'all', label: <>All <Count n={counted.all} /></> },
    ...CATEGORIES.filter((c) => counted[c.id]).map((c) => ({
      id: c.id as Filter,
      label: <>{c.label} <Count n={counted[c.id]} /></>,
    })),
    ...(counted.favorites ? [{ id: 'favorites' as Filter, label: <><Heart size={13} /> Favourites</> }] : []),
  ]

  return (
    <div
      className="relative min-h-full"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        onFiles(e.dataTransfer.files)
      }}
    >
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-ink-3 text-sm">{items.length} pieces</p>
          <h1 className="font-display text-5xl md:text-6xl leading-none tracking-tight">Wardrobe</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="soft" size="icon" className="md:hidden" onClick={() => camRef.current?.click()} aria-label="Take photo">
            <Camera size={18} />
          </Button>
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={17} /> Add clothes
          </Button>
        </div>
      </header>

      {items.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sticky top-0 z-20 -mx-4 px-4 md:-mx-8 md:px-8 py-3 bg-bg/85 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, colour, type…"
                className="w-full h-10 rounded-full bg-surface pl-10 pr-9 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-ink/30 transition"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink cursor-pointer" aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-10 rounded-full bg-surface ring-1 ring-line px-3 text-sm outline-none cursor-pointer"
              aria-label="Sort"
            >
              <option value="recent">Recently added</option>
              <option value="most">Most worn</option>
              <option value="least">Least worn</option>
            </select>
          </div>
          <Segmented id="wardrobe-filter" options={filterOptions} value={filter} onChange={setFilter} />
        </div>
      )}

      <motion.div layout className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        <AnimatePresence mode="popLayout">
          {uploads.map((u) => (
            <motion.div
              key={`up-${u.id}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-tile"
            >
              <img src={u.preview} alt="" className={cx('absolute inset-0 h-full w-full object-cover', !u.error && 'opacity-60 blur-[1px] scale-105')} />
              {!u.error && <div className="absolute inset-0 shimmer" />}
              <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-surface/90 backdrop-blur-md p-2.5">
                <div className="flex items-center gap-1.5 text-[12px] font-medium">
                  {u.error ? <X size={13} className="text-danger" /> : <Wand2 size={13} className="animate-pulse" />}
                  <span className="truncate">{u.error ? 'Couldn’t process photo' : u.stage}</span>
                </div>
                {u.error ? (
                  <button onClick={() => dismissUpload(u.id)} className="mt-1 text-[12px] text-ink-2 underline cursor-pointer">Dismiss</button>
                ) : (
                  <div className="mt-2 h-1 rounded-full bg-line overflow-hidden">
                    <motion.div
                      className="h-full bg-ink rounded-full"
                      animate={{ width: u.progress != null ? `${Math.round(u.progress * 100)}%` : '35%' }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {visible.map((it, i) => (
            <ItemCard
              key={`it-${it.id}`}
              item={it}
              image={images[it.id]}
              worn={counts[it.id] ?? 0}
              index={i}
              fresh={it.createdAt > mountedAt.current}
              onClick={() => setOpenId(it.id)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {items.length === 0 && uploads.length === 0 && (
        <Empty
          icon={<Shirt size={28} />}
          title="Start your digital closet"
          body="Snap or upload photos of your clothes. Backgrounds are removed and each piece is sorted into a category automatically — all on your device."
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={17} /> Upload photos
                </Button>
                <Button onClick={() => camRef.current?.click()}>
                  <Camera size={17} /> Camera
                </Button>
              </div>
              <span className="text-xs text-ink-3">or drop images anywhere</span>
              <button
                disabled={loadingSamples}
                onClick={async () => {
                  setLoadingSamples(true)
                  mountedAt.current = 0
                  await loadSampleWardrobe()
                  setLoadingSamples(false)
                  toast({ text: 'Sample wardrobe loaded — have a play!' })
                }}
                className="mt-4 group flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2.5 text-sm font-medium cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform disabled:opacity-60"
              >
                <Sparkles size={15} className="group-hover:rotate-12 transition-transform" />
                {loadingSamples ? 'Unpacking…' : 'Just exploring? Try a sample wardrobe'}
              </button>
            </div>
          }
        />
      )}
      {items.length > 0 && visible.length === 0 && (
        <p className="text-center text-ink-3 text-sm py-16">Nothing matches that — try another filter.</p>
      )}

      <div className="mt-8 flex justify-center">
        <button
          onClick={toggleBg}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-2 hover:bg-surface-2 cursor-pointer"
        >
          <Sparkles size={13} />
          Automatic background removal
          <span className={cx('relative h-4 w-7 rounded-full transition-colors', removeBg ? 'bg-ink' : 'bg-line')}>
            <motion.span
              className="absolute top-0.5 h-3 w-3 rounded-full bg-bg"
              animate={{ left: removeBg ? 14 : 2 }}
            />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-[32px] border-2 border-dashed border-ink/30 bg-bg/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <ImagePlus size={36} className="mx-auto" />
              <div className="font-display text-3xl mt-2">Drop to add</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ItemSheet id={openId} onClose={() => setOpenId(null)} wornCount={openId ? counts[openId] ?? 0 : 0} />
    </div>
  )
}

function Count({ n }: { n: number }) {
  return <span className="opacity-50 tabular-nums">{n}</span>
}
