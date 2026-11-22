import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Flame, Layers, Pencil, RefreshCw, Shirt, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { OutfitPreview } from '../components/OutfitPreview'
import { Burst, Button, CountUp, cx, useToast } from '../components/ui'
import { loadSampleWardrobe } from '../lib/samples'
import { isoDate, saveOutfit, scheduleOutfit, streak, uid, unscheduleOutfit, useStore, wearCounts } from '../lib/store'
import { BACKDROPS, layoutFor, suggestOutfit } from '../lib/suggest'
import type { Item } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TodayView({
  onBuilder,
  onCalendar,
  onWardrobe,
}: {
  onBuilder: (outfitId?: string) => void
  onCalendar: (date?: string) => void
  onWardrobe: () => void
}) {
  const items = useStore((s) => s.items)
  const outfits = useStore((s) => s.outfits)
  const calendar = useStore((s) => s.calendar)
  const images = useStore((s) => s.images)
  const toast = useToast()
  const today = isoDate(new Date())

  const { counts, lastWorn } = useMemo(() => wearCounts(outfits, calendar, today), [outfits, calendar, today])
  const todays = (calendar[today] ?? []).map((id) => outfits.find((o) => o.id === id)).filter(Boolean)
  const current = todays[0]

  const [pick, setPick] = useState<Item[]>([])
  const [pickKey, setPickKey] = useState(0)
  const [burst, setBurst] = useState(0)
  const [backdrop, setBackdrop] = useState('blush')
  const [loading, setLoading] = useState(false)

  const reroll = () => {
    setPick((prev) => suggestOutfit(items, counts, new Set(prev.map((i) => i.id))))
    setPickKey((k) => k + 1)
    const pool = BACKDROPS.filter((b) => b.id !== 'night' && b.id !== 'dots')
    setBackdrop(pool[Math.floor(Math.random() * pool.length)].id)
  }
  // (Re)suggest when the wardrobe changes — debounced so a batch import settles first
  useEffect(() => {
    if (current || !items.length) return
    const t = setTimeout(reroll, pick.length ? 400 : 0)
    return () => clearTimeout(t)
  }, [items.length, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const wear = async () => {
    if (!pick.length) return
    const id = uid()
    const now = Date.now()
    const name = `${new Date().toLocaleDateString(undefined, { weekday: 'long' })} pick`
    await saveOutfit({ id, name, backdrop, placements: layoutFor(pick), createdAt: now, updatedAt: now })
    await scheduleOutfit(today, id)
    setBurst((b) => b + 1)
    toast({ text: 'Locked in for today ✨' })
  }

  const week = useMemo(() => {
    const d = new Date()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(monday)
      x.setDate(monday.getDate() + i)
      const iso = isoDate(x)
      const o = (calendar[iso] ?? []).map((id) => outfits.find((oo) => oo.id === id)).find(Boolean)
      return { iso, d: x, outfit: o }
    })
  }, [calendar, outfits])

  const palette = useMemo(() => {
    const m = new Map<string, { color: string; n: number }>()
    for (const it of items) {
      const e = m.get(it.colorName)
      if (e) e.n++
      else m.set(it.colorName, { color: it.color, n: 1 })
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n)
  }, [items])

  const rediscover = useMemo(() => {
    const cut = new Date()
    cut.setDate(cut.getDate() - 21)
    const c = isoDate(cut)
    return items.filter((i) => !lastWorn[i.id] || lastWorn[i.id] < c).slice(0, 14)
  }, [items, lastWorn])

  const s = streak(calendar)
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  // ---------- First run ----------
  if (!items.length) {
    return (
      <div className="relative">
        <p className="text-ink-3 text-sm">{dateLine}</p>
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
          {greeting()}.
          <br />
          <span className="italic text-ink-2">Let’s build your closet.</span>
        </h1>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {[
            { icon: Shirt, title: 'Snap your clothes', body: 'Backgrounds vanish and every piece files itself into the right category.' },
            { icon: Layers, title: 'Style outfits', body: 'Drag pieces onto a mood board, or let Shuffle surprise you.' },
            { icon: Flame, title: 'Plan your week', body: 'Put looks on the calendar and see what you actually wear.' },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.08 } }}
              className="rounded-[28px] bg-surface shadow-soft p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft">
                <f.icon size={20} />
              </div>
              <div className="mt-4 font-display text-2xl">{f.title}</div>
              <p className="text-sm text-ink-2 mt-1">{f.body}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" className="h-12 px-6" onClick={onWardrobe}>
            Add my clothes <ArrowRight size={16} />
          </Button>
          <Button
            className="h-12 px-6"
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              await loadSampleWardrobe()
              setLoading(false)
            }}
          >
            <Sparkles size={16} /> {loading ? 'Unpacking…' : 'Try a sample wardrobe'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-ink-3 text-sm">{dateLine}</p>
        <h1 className="font-display text-5xl md:text-6xl leading-none tracking-tight">{greeting()}</h1>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
        {/* ---- Hero: today's outfit ---- */}
        <motion.section
          layout
          className="relative min-w-0 rounded-[36px] bg-surface shadow-soft p-4 md:p-5 overflow-visible"
        >
          <div className="flex items-center justify-between px-1 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-3">{current ? 'You’re wearing' : 'Today’s pick for you'}</div>
              <div className="font-display text-3xl">{current ? current.name : 'What to wear?'}</div>
            </div>
            {current ? (
              <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium">
                <Check size={14} /> Planned
              </span>
            ) : (
              <Button size="icon" onClick={reroll} aria-label="Another suggestion">
                <motion.span key={pickKey} initial={{ rotate: -180 }} animate={{ rotate: 0 }}>
                  <RefreshCw size={17} />
                </motion.span>
              </Button>
            )}
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4">
            <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[380px] rounded-[28px] overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={current ? current.id : `pick-${pickKey}`}
                  initial={{ opacity: 0, x: 40, rotate: 3 }}
                  animate={{ opacity: 1, x: 0, rotate: 0 }}
                  exit={{ opacity: 0, x: -40, rotate: -3 }}
                >
                  <OutfitPreview
                    placements={current ? current.placements : layoutFor(pick)}
                    backdrop={current ? current.backdrop : backdrop}
                    animate
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <Burst fire={burst} colors={(current ? current.placements.map((p) => items.find((i) => i.id === p.itemId)?.color ?? '') : pick.map((i) => i.color)).filter(Boolean)} />

            <div className="flex flex-wrap md:flex-col gap-2 md:w-40 justify-center md:justify-end [&>button]:whitespace-nowrap">
              {current ? (
                <>
                  <Button onClick={() => onBuilder(current.id)}>
                    <Pencil size={15} /> Tweak
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await unscheduleOutfit(today, current.id)
                      reroll()
                    }}
                  >
                    <RefreshCw size={15} /> Swap
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" className="h-12" onClick={wear}>
                    <Check size={16} /> Wear this
                  </Button>
                  <Button onClick={reroll}>
                    <Sparkles size={15} /> Another
                  </Button>
                  <Button variant="ghost" onClick={() => onBuilder()}>
                    <Layers size={15} /> Build my own
                  </Button>
                </>
              )}
            </div>
          </div>

          {!current && pick.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar px-1">
              {pick.map((it) => (
                <motion.span
                  key={`${pickKey}-${it.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="shrink-0 flex items-center gap-1.5 rounded-full bg-surface-2 pl-1 pr-3 py-1 text-xs"
                >
                  {images[it.id] && <img src={images[it.id]} alt="" className="h-6 w-6 rounded-full bg-surface object-contain p-0.5" />}
                  {it.name}
                </motion.span>
              ))}
            </div>
          )}
        </motion.section>

        {/* ---- Side column ---- */}
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Pieces" value={items.length} onClick={onWardrobe} />
            <Stat label="Looks" value={outfits.length} onClick={() => onBuilder()} />
            <Stat label="Day streak" value={s} emoji={s > 1 ? '🔥' : undefined} onClick={() => onCalendar()} highlight={s > 1} />
          </div>

          <section className="rounded-[28px] bg-surface shadow-soft p-4">
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="font-medium text-sm">This week</div>
              <button onClick={() => onCalendar()} className="text-xs text-ink-3 hover:text-ink flex items-center gap-1 cursor-pointer">
                Calendar <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {week.map((w, i) => (
                <motion.button
                  key={w.iso}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                  whileHover={{ y: -3 }}
                  onClick={() => onCalendar(w.iso)}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span className={cx('text-[10px] uppercase tracking-wide', w.iso === today ? 'text-ink font-semibold' : 'text-ink-3')}>
                    {w.d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                  <div
                    className={cx(
                      'relative w-full aspect-[3/4] rounded-xl overflow-hidden',
                      w.iso === today && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                      !w.outfit && 'bg-surface-2',
                    )}
                  >
                    {w.outfit ? (
                      <OutfitPreview placements={w.outfit.placements} backdrop={w.outfit.backdrop} className="!aspect-auto h-full" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-ink-3 text-xs">+</span>
                    )}
                  </div>
                  <span className="text-[11px] tabular-nums text-ink-2">{w.d.getDate()}</span>
                </motion.button>
              ))}
            </div>
          </section>

          {palette.length > 0 && (
            <section className="rounded-[28px] bg-surface shadow-soft p-5">
              <div className="flex items-baseline justify-between">
                <div className="font-medium text-sm">Your palette</div>
                <div className="text-xs text-ink-3">{palette.length} colours</div>
              </div>
              <div className="mt-3 flex h-10 w-full overflow-hidden rounded-2xl ring-1 ring-line">
                {palette.map((c, i) => (
                  <motion.div
                    key={c.name}
                    title={`${c.name} · ${c.n}`}
                    className="h-full first:rounded-l-2xl last:rounded-r-2xl hover:brightness-110"
                    style={{ background: c.color }}
                    initial={{ flexGrow: 0 }}
                    animate={{ flexGrow: c.n, transition: { delay: 0.2 + i * 0.05, type: 'spring', stiffness: 120, damping: 18 } }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                {palette.slice(0, 6).map((c) => (
                  <span key={c.name} className="flex items-center gap-1.5 text-xs text-ink-2">
                    <span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ background: c.color }} />
                    {c.name} <span className="text-ink-3">{Math.round((c.n / items.length) * 100)}%</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {rediscover.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-3xl">Rediscover</h2>
            <span className="text-sm text-ink-3">Not worn in 3 weeks</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:-mx-8 md:px-8 pb-2 snap-x">
            {rediscover.map((it, i) => (
              <motion.button
                key={it.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }}
                whileHover={{ y: -4, rotate: i % 2 ? 1.5 : -1.5 }}
                onClick={onWardrobe}
                className="snap-start shrink-0 w-32 cursor-pointer text-left"
              >
                <div
                  className="aspect-square rounded-3xl grid place-items-center relative overflow-hidden"
                  style={{ background: `color-mix(in oklab, ${it.color} 22%, var(--tile))` }}
                >
                  {images[it.id] && <img src={images[it.id]} alt="" className="absolute inset-0 m-auto h-[72%] w-[72%] object-contain cutout" />}
                </div>
                <div className="mt-1.5 truncate text-xs font-medium">{it.name}</div>
              </motion.button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, emoji, onClick, highlight }: { label: string; value: number; emoji?: string; onClick: () => void; highlight?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cx('rounded-[24px] p-4 text-left cursor-pointer shadow-soft', highlight ? 'bg-accent-soft' : 'bg-surface')}
    >
      <div className="font-display text-4xl leading-none">
        <CountUp value={value} />
        {emoji && <span className="text-2xl ml-1">{emoji}</span>}
      </div>
      <div className="text-xs text-ink-3 mt-1.5">{label}</div>
    </motion.button>
  )
}
