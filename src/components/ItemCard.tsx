import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { Heart } from 'lucide-react'
import type { Item } from '../lib/types'
import { categoryLabel } from '../lib/categories'

/** Wardrobe tile: tinted with the item's colour, tilts toward the pointer, and glows when freshly added. */
export function ItemCard({
  item,
  image,
  worn,
  index,
  fresh,
  onClick,
}: {
  item: Item
  image?: string
  worn: number
  index: number
  fresh: boolean
  onClick: () => void
}) {
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 250, damping: 20 })
  const ry = useSpring(useTransform(px, [0, 1], [-7, 7]), { stiffness: 250, damping: 20 })
  const imgX = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 250, damping: 20 })
  const imgY = useSpring(useTransform(py, [0, 1], [-6, 6]), { stiffness: 250, damping: 20 })
  const shine = useTransform([px, py], ([x, y]: number[]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgb(255 255 255 / 0.35), transparent 55%)`)

  const needsCheck = item.confidence == null || item.confidence < 0.2

  return (
    <motion.button
      layout
      initial={fresh ? { opacity: 0, scale: 0.6, filter: 'blur(10px)' } : { opacity: 0, y: 18 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: fresh ? { type: 'spring', stiffness: 260, damping: 18 } : { delay: Math.min(index, 12) * 0.03 },
      }}
      exit={{ opacity: 0, scale: 0.85 }}
      whileTap={{ scale: 0.96 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        px.set((e.clientX - r.left) / r.width)
        py.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => (px.set(0.5), py.set(0.5))}
      onClick={onClick}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformPerspective: 800,
        background: `linear-gradient(165deg, color-mix(in oklab, ${item.color} 10%, var(--tile)) 0%, color-mix(in oklab, ${item.color} 26%, var(--tile)) 100%)`,
      }}
      className="group relative aspect-[4/5] rounded-3xl overflow-hidden text-left cursor-pointer will-change-transform"
    >
      {/* soft spotlight behind the garment */}
      <div
        className="absolute left-1/2 top-[42%] h-[60%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
        style={{ background: `color-mix(in oklab, ${item.color} 35%, white)` }}
      />
      {image && (
        <motion.img
          src={image}
          alt={item.name}
          draggable={false}
          style={{ x: imgX, y: imgY }}
          className="absolute inset-x-0 top-2 bottom-[4.75rem] m-auto h-[80%] w-[74%] object-contain cutout transition-transform duration-500 ease-out group-hover:scale-[1.07] group-hover:-rotate-2"
        />
      )}
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: shine }} />

      {fresh && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-3xl ring-[3px] ring-accent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.2, delay: 0.4 }}
        />
      )}

      <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-2">
        {needsCheck ? (
          <span className="rounded-full bg-surface/85 backdrop-blur px-2 py-0.5 text-[11px] font-medium">⚠︎ Check category</span>
        ) : fresh ? (
          <span className="rounded-full bg-accent text-accent-ink px-2 py-0.5 text-[11px] font-semibold">✨ New</span>
        ) : (
          <span className="rounded-full bg-surface/70 backdrop-blur px-2 py-0.5 text-[11px] font-medium text-ink-2 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
            {categoryLabel(item.category)}
          </span>
        )}
        {item.favorite && <Heart size={16} className="shrink-0 fill-danger text-danger drop-shadow" />}
      </div>

      <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-surface/75 backdrop-blur-md px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: item.color }} />
          <span className="truncate text-[13px] font-medium">{item.name}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-3">
          {worn ? (
            <>
              <span className="flex gap-0.5">
                {Array.from({ length: Math.min(worn, 5) }, (_, i) => (
                  <span key={i} className="h-1 w-2.5 rounded-full bg-ink/60" />
                ))}
              </span>
              Worn {worn}×
            </>
          ) : (
            'Not worn yet'
          )}
        </div>
      </div>
    </motion.button>
  )
}
