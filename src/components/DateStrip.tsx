import { motion } from 'motion/react'
import { isoDate } from '../lib/store'
import { cx } from './ui'

/** Horizontally scrolling strip of the next two weeks, plus a native picker for anything further out. */
export function DateStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
        {days.map((d, i) => {
          const iso = isoDate(d)
          const active = iso === value
          return (
            <button
              key={iso}
              onClick={() => onChange(iso)}
              className={cx(
                'relative shrink-0 w-14 h-[68px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors',
                active ? 'text-accent-ink' : 'bg-surface-2 text-ink-2 hover:text-ink',
              )}
            >
              {active && <motion.span layoutId="date-strip" className="absolute inset-0 rounded-2xl bg-accent" />}
              <span className="relative text-[11px] uppercase tracking-wide opacity-70">
                {i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="relative text-lg font-semibold tabular-nums">{d.getDate()}</span>
            </button>
          )
        })}
      </div>
      <label className="flex items-center justify-between text-sm text-ink-2">
        Or pick another date
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-9 rounded-full bg-surface-2 px-3 text-sm text-ink outline-none"
        />
      </label>
    </div>
  )
}
