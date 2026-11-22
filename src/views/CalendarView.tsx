import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Shirt, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { OutfitPreview } from '../components/OutfitPreview'
import { Button, Sheet, cx, useToast } from '../components/ui'
import { isoDate, scheduleOutfit, streak, unscheduleOutfit, useStore, wearCounts } from '../lib/store'
import { fmtDate } from './BuilderView'

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, i + 1).toLocaleDateString(undefined, { weekday: 'short' }),
) // 2024-01-01 is a Monday

export function CalendarView({
  focusDate,
  onCreate,
  onEdit,
}: {
  focusDate?: string
  onCreate: (date: string) => void
  onEdit: (outfitId: string) => void
}) {
  const outfits = useStore((s) => s.outfits)
  const calendar = useStore((s) => s.calendar)
  const items = useStore((s) => s.items)
  const images = useStore((s) => s.images)
  const toast = useToast()
  const today = isoDate(new Date())

  const [selected, setSelected] = useState(focusDate ?? today)
  const [month, setMonth] = useState(() => {
    const [y, m] = (focusDate ?? today).split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [dir, setDir] = useState(0)
  const [pickOpen, setPickOpen] = useState(false)

  const byId = useMemo(() => new Map(outfits.map((o) => [o.id, o])), [outfits])

  const cells = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7 // Monday-first
    const start = new Date(first)
    start.setDate(1 - offset)
    const weeks = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return { iso: isoDate(d), day: d.getDate(), inMonth: d.getMonth() === month.getMonth() }
    })
  }, [month])

  const go = (delta: number) => {
    setDir(delta)
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }
  const goToday = () => {
    const [y, m] = today.split('-').map(Number)
    const target = new Date(y, m - 1, 1)
    setDir(target > month ? 1 : -1)
    setMonth(target)
    setSelected(today)
  }

  const dayOutfits = (calendar[selected] ?? []).map((id) => byId.get(id)).filter(Boolean) as typeof outfits

  // Insights: planned this month, items not worn in 30+ days
  const stats = useMemo(() => {
    const prefix = isoDate(month).slice(0, 7)
    const planned = Object.keys(calendar).filter((d) => d.startsWith(prefix)).length
    const { lastWorn } = wearCounts(outfits, calendar, today)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cut = isoDate(cutoff)
    const forgotten = items.filter((it) => !lastWorn[it.id] || lastWorn[it.id] < cut)
    return { planned, forgotten }
  }, [calendar, outfits, items, month, today])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-ink-3 text-sm">
            {stats.planned} day{stats.planned === 1 ? '' : 's'} planned this month
            {streak(calendar) > 1 && <span className="ml-2 rounded-full bg-accent-soft text-ink px-2 py-0.5 text-xs font-medium">🔥 {streak(calendar)}-day streak</span>}
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-none tracking-tight">Calendar</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
          <Button variant="soft" size="icon" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={18} /></Button>
          <Button variant="soft" size="icon" onClick={() => go(1)} aria-label="Next month"><ChevronRight size={18} /></Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="rounded-[32px] bg-surface shadow-soft p-3 md:p-5 overflow-hidden">
          <div className="flex items-center justify-between px-1 pb-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={month.toISOString()}
                initial={{ opacity: 0, y: dir * 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: dir * -8 }}
                className="font-display text-3xl"
              >
                {month.toLocaleDateString(undefined, { month: 'long' })}{' '}
                <span className="text-ink-3">{month.getFullYear()}</span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="grid grid-cols-7 gap-1 md:gap-1.5 text-center text-[11px] uppercase tracking-wide text-ink-3 pb-1.5">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={month.toISOString()}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, i) => {
                if (i.offset.x < -60) go(1)
                else if (i.offset.x > 60) go(-1)
              }}
              className="grid grid-cols-7 gap-1 md:gap-1.5"
            >
              {cells.map((c) => {
                const ids = calendar[c.iso] ?? []
                const first = ids.length ? byId.get(ids[0]) : undefined
                const isSel = c.iso === selected
                const isToday = c.iso === today
                return (
                  <button
                    key={c.iso}
                    onClick={() => setSelected(c.iso)}
                    className={cx(
                      'relative aspect-[3/4] md:aspect-[4/5] rounded-2xl text-left overflow-hidden transition-colors cursor-pointer',
                      c.inMonth ? 'bg-surface-2/60 hover:bg-surface-2' : 'opacity-35',
                      c.iso < today && !ids.length && 'opacity-60',
                    )}
                  >
                    {isSel && (
                      <motion.span layoutId="cal-sel" className="absolute inset-0 rounded-2xl ring-2 ring-ink z-10 pointer-events-none" />
                    )}
                    {first && (
                      <OutfitPreview placements={first.placements} backdrop={first.backdrop} className="absolute inset-0 !h-full !aspect-auto" />
                    )}
                    <span
                      className={cx(
                        'absolute top-1 left-1 md:top-1.5 md:left-1.5 z-10 grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] tabular-nums font-medium',
                        isToday ? 'bg-accent text-accent-ink' : first ? 'bg-surface/85 backdrop-blur' : 'text-ink-2',
                      )}
                    >
                      {c.day}
                    </span>
                    {ids.length > 1 && (
                      <span className="absolute bottom-1 right-1 z-10 rounded-full bg-ink text-bg px-1.5 text-[10px] font-semibold">+{ids.length - 1}</span>
                    )}
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ---- Day panel ---- */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="rounded-[28px] bg-surface shadow-soft p-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-ink-3">
                      {longDate(selected)}
                    </div>
                    <div className="font-display text-3xl capitalize">{fmtDate(selected)}</div>
                  </div>
                  <Button size="icon" variant="primary" onClick={() => setPickOpen(true)} aria-label="Add outfit">
                    <Plus size={18} />
                  </Button>
                </div>

                {dayOutfits.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center">
                    <CalendarDays size={22} className="mx-auto text-ink-3" />
                    <p className="text-sm text-ink-2 mt-2">No outfit {selected < today ? 'logged' : 'planned'} yet.</p>
                    <div className="mt-3 flex justify-center gap-2">
                      {outfits.length > 0 && (
                        <Button size="sm" onClick={() => setPickOpen(true)}>Choose a look</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onCreate(selected)}>
                        <Sparkles size={14} /> Create new
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {dayOutfits.map((o) => (
                        <motion.div
                          key={o.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex gap-3 rounded-2xl bg-surface-2/70 p-2"
                        >
                          <div className="w-24 shrink-0 rounded-xl overflow-hidden">
                            <OutfitPreview placements={o.placements} backdrop={o.backdrop} />
                          </div>
                          <div className="flex-1 min-w-0 py-1 flex flex-col">
                            <div className="font-medium truncate">{o.name}</div>
                            <div className="flex -space-x-2 mt-2">
                              {o.placements.slice(0, 5).map((p) =>
                                images[p.itemId] ? (
                                  <img key={p.itemId} src={images[p.itemId]} alt="" className="h-8 w-8 rounded-full bg-surface ring-2 ring-surface-2 object-contain p-0.5" />
                                ) : null,
                              )}
                            </div>
                            <div className="mt-auto flex gap-1">
                              <Button size="sm" variant="ghost" className="!px-2" onClick={() => onEdit(o.id)}>
                                <Pencil size={13} /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!px-2"
                                onClick={() => {
                                  unscheduleOutfit(selected, o.id)
                                  const d = selected
                                  toast({ text: 'Removed from day', action: { label: 'Undo', onClick: () => scheduleOutfit(d, o.id) } })
                                }}
                              >
                                <X size={13} /> Remove
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {items.length > 0 && stats.forgotten.length > 0 && (
            <div className="rounded-[28px] bg-accent-soft p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shirt size={15} /> Give these some love
              </div>
              <p className="text-xs text-ink-2 mt-1">Not worn in the last 30 days</p>
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {stats.forgotten.slice(0, 12).map((it) =>
                  images[it.id] ? (
                    <img key={it.id} src={images[it.id]} alt={it.name} title={it.name} className="h-14 w-14 shrink-0 rounded-xl bg-surface/70 object-contain p-1" />
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title={`Outfit for ${fmtDate(selected)}`} wide>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <button
            onClick={() => (setPickOpen(false), onCreate(selected))}
            className="aspect-[3/4] rounded-2xl border-2 border-dashed border-line grid place-items-center text-ink-2 hover:text-ink hover:border-ink/30 transition-colors cursor-pointer"
          >
            <span className="flex flex-col items-center gap-2 text-sm">
              <Plus size={22} /> New look
            </span>
          </button>
          {outfits.map((o) => {
            const on = (calendar[selected] ?? []).includes(o.id)
            return (
              <motion.button
                key={o.id}
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  if (on) await unscheduleOutfit(selected, o.id)
                  else {
                    await scheduleOutfit(selected, o.id)
                    setPickOpen(false)
                  }
                }}
                className={cx('rounded-2xl overflow-hidden text-left ring-2 cursor-pointer', on ? 'ring-ink' : 'ring-transparent')}
              >
                <OutfitPreview placements={o.placements} backdrop={o.backdrop} />
                <div className="bg-surface-2 px-3 py-2 text-sm font-medium truncate">{o.name}</div>
              </motion.button>
            )
          })}
        </div>
      </Sheet>
    </div>
  )
}

function longDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}
