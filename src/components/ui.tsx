import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger'
  size?: 'sm' | 'md' | 'icon'
}
export function Button({ variant = 'soft', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,color,transform,opacity] duration-200 active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'icon' && 'h-10 w-10',
        variant === 'primary' && 'bg-accent text-accent-ink hover:opacity-90',
        variant === 'soft' && 'bg-surface-2 text-ink hover:bg-line',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger/20',
        className,
      )}
    />
  )
}

/** Animated segmented control / chip row with a sliding pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  id,
  className,
}: {
  options: { id: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  id: string
  className?: string
}) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto no-scrollbar', className)}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cx(
              'relative shrink-0 h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer',
              active ? 'text-accent-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-accent" />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  const controls = useDragControls()
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cx(
              'relative w-full bg-surface shadow-soft flex flex-col max-h-[92dvh] rounded-t-[28px] md:rounded-[28px] pb-safe',
              wide ? 'md:max-w-3xl' : 'md:max-w-lg',
            )}
            initial={isDesktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            drag={isDesktop ? false : 'y'}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="touch-none" onPointerDown={(e) => !isDesktop && controls.start(e)}>
              <div className="md:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
              <div className="flex items-center justify-between px-5 pt-3 md:pt-5 pb-2">
                <div className="font-display text-2xl leading-tight">{title}</div>
                <Button variant="ghost" size="icon" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close">
                <X size={18} />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 pb-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ---------- Toasts ----------
interface Toast {
  id: number
  text: ReactNode
  action?: { label: string; onClick: () => void }
}
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((s) => [...s.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 md:bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink text-bg pl-4 pr-2 py-2 text-sm shadow-soft max-w-full"
            >
              <span className="truncate">{t.text}</span>
              {t.action && (
                <button
                  className="rounded-full bg-bg/15 px-3 py-1 text-[13px] font-medium hover:bg-bg/25 cursor-pointer"
                  onClick={() => {
                    t.action!.onClick()
                    setToasts((s) => s.filter((x) => x.id !== t.id))
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-16 px-6"
    >
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-accent-soft text-ink mb-4">{icon}</div>
      <div className="font-display text-2xl">{title}</div>
      <p className="text-ink-2 text-sm mt-1 max-w-xs">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
