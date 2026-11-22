import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Layers, Shirt, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ToastProvider, cx } from './components/ui'
import { useStore } from './lib/store'
import { BuilderView, type BuilderIntent } from './views/BuilderView'
import { CalendarView } from './views/CalendarView'
import { TodayView } from './views/TodayView'
import { WardrobeView } from './views/WardrobeView'

type Tab = 'today' | 'wardrobe' | 'builder' | 'calendar'
const TABS: { id: Tab; label: string; icon: typeof Shirt }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { id: 'builder', label: 'Outfits', icon: Layers },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]
const ORDER: Tab[] = ['today', 'wardrobe', 'builder', 'calendar']

export default function App() {
  const ready = useStore((s) => s.ready)
  const uploads = useStore((s) => s.uploads.filter((u) => !u.error).length)
  const [tab, setTabRaw] = useState<Tab>(() => {
    const h = location.hash.slice(1) as Tab
    return ORDER.includes(h) ? h : 'today'
  })
  const [dir, setDir] = useState(0)
  const [intent, setIntent] = useState<BuilderIntent | null>(null)
  const [focusDate, setFocusDate] = useState<string | undefined>()

  const setTab = (t: Tab) => {
    setDir(ORDER.indexOf(t) > ORDER.indexOf(tab) ? 1 : -1)
    setTabRaw(t)
    history.replaceState(null, '', `#${t}`)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.slice(1) as Tab
      if (ORDER.includes(h)) setTabRaw(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <ToastProvider>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="blob absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-accent-soft opacity-70 blur-3xl" />
        <div className="blob blob-2 absolute top-1/2 -left-48 h-[460px] w-[460px] rounded-full bg-[color-mix(in_oklab,var(--accent-soft)_60%,#b9c9e6)] opacity-50 blur-3xl" />
      </div>
      <div className="min-h-full md:pl-[92px] lg:pl-[232px]">
        {/* Sidebar (tablet / desktop) */}
        <nav className="hidden md:flex fixed inset-y-0 left-0 z-30 w-[92px] lg:w-[232px] flex-col border-r border-line bg-bg/70 backdrop-blur-xl px-3 lg:px-4 py-6">
          <div className="flex items-center gap-2.5 px-2 lg:px-3 mb-8">
            <Logo />
            <span className="hidden lg:block font-display text-[28px] leading-none">Racks</span>
          </div>
          <div className="flex flex-col gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'relative flex items-center gap-3 h-12 rounded-2xl px-4 text-sm font-medium transition-colors cursor-pointer justify-center lg:justify-start',
                  tab === t.id ? 'text-accent-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-2',
                )}
                title={t.label}
              >
                {tab === t.id && <motion.span layoutId="nav-side" className="absolute inset-0 rounded-2xl bg-accent" />}
                <t.icon size={19} className="relative" />
                <span className="relative hidden lg:inline">{t.label}</span>
                {t.id === 'wardrobe' && uploads > 0 && (
                  <span className="relative ml-auto hidden lg:grid h-5 min-w-5 place-items-center rounded-full bg-accent-soft text-ink px-1.5 text-[11px]">
                    {uploads}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-auto hidden lg:block px-3 text-[11px] leading-relaxed text-ink-3">
            Everything stays on this device. Photos are processed locally in your browser.
          </p>
        </nav>

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-4 pt-4">
          <Logo />
          <span className="font-display text-2xl">Racks</span>
        </div>

        <main className="px-4 md:px-8 pt-4 md:pt-8 pb-32 md:pb-12 max-w-[1400px] mx-auto">
          {!ready ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-20">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="aspect-[4/5] rounded-3xl bg-tile shimmer" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: dir * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -24 }}
                transition={{ type: 'spring', stiffness: 500, damping: 42 }}
              >
                {tab === 'today' && (
                  <TodayView
                    onWardrobe={() => setTab('wardrobe')}
                    onBuilder={(outfitId) => {
                      setIntent({ outfitId, nonce: Date.now() })
                      setTab('builder')
                    }}
                    onCalendar={(date) => {
                      setFocusDate(date)
                      setTab('calendar')
                    }}
                  />
                )}
                {tab === 'wardrobe' && <WardrobeView />}
                {tab === 'builder' && (
                  <BuilderView
                    intent={intent}
                    onDone={(d) => {
                      setFocusDate(d)
                      setTab('calendar')
                    }}
                  />
                )}
                {tab === 'calendar' && (
                  <CalendarView
                    focusDate={focusDate}
                    onCreate={(date) => {
                      setIntent({ scheduleDate: date, nonce: Date.now() })
                      setTab('builder')
                    }}
                    onEdit={(outfitId) => {
                      setIntent({ outfitId, nonce: Date.now() })
                      setTab('builder')
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Bottom tab bar (phones) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md flex items-center justify-around gap-1 rounded-full bg-surface/85 backdrop-blur-xl shadow-soft ring-1 ring-line p-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'relative flex items-center justify-center gap-1.5 h-12 rounded-full text-[13px] font-medium cursor-pointer transition-[color,flex-grow] duration-300',
                  tab === t.id ? 'text-accent-ink flex-[1.9] px-3' : 'text-ink-2 flex-1',
                )}
              >
                {tab === t.id && <motion.span layoutId="nav-bottom" className="absolute inset-0 rounded-full bg-accent" />}
                <t.icon size={18} className="relative" />
                <AnimatePresence initial={false}>
                  {tab === t.id && (
                    <motion.span
                      className="relative overflow-hidden whitespace-nowrap"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                    >
                      {t.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {t.id === 'wardrobe' && uploads > 0 && tab !== t.id && (
                  <span className="absolute top-2 right-[30%] h-2 w-2 rounded-full bg-danger" />
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ToastProvider>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--ink)" />
      <path
        d="M32 15a5 5 0 0 1 5 5c0 2.2-1.4 3.4-3 4.4-1 .6-2 1.3-2 2.6v1l17 11c2.4 1.5 1.3 5.2-1.6 5.2H16.6c-2.9 0-4-3.7-1.6-5.2L32 28"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
