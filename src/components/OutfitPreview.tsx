import { motion } from 'motion/react'
import type { Placement } from '../lib/types'
import { useStore } from '../lib/store'
import { backdropStyle } from '../lib/suggest'
import { cx } from './ui'

/**
 * Static render of an outfit's layout — scales to whatever box it's placed in.
 * `backdrop`: an id from BACKDROPS, or null for a transparent background.
 * `animate` staggers the pieces in, like they're being laid out.
 */
export function OutfitPreview({
  placements,
  className,
  backdrop,
  animate,
}: {
  placements: Placement[]
  className?: string
  backdrop?: string | null
  animate?: boolean
}) {
  const images = useStore((s) => s.images)
  const style = backdrop === null ? undefined : backdropStyle(backdrop)
  return (
    <div
      className={cx('relative aspect-[3/4] w-full overflow-hidden', backdrop !== null && !style && 'bg-check', className)}
      style={style}
    >
      {[...placements]
        .sort((a, b) => a.z - b.z)
        .map((p, i) =>
          images[p.itemId] ? (
            <div
              key={p.itemId}
              className="absolute"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.w * 100}%`,
                transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
              }}
            >
              <motion.img
                src={images[p.itemId]}
                alt=""
                draggable={false}
                className="block w-full cutout pointer-events-none"
                initial={animate ? { opacity: 0, y: -30, scale: 0.7, rotate: -8 } : false}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: animate ? i * 0.08 : 0 }}
              />
            </div>
          ) : null,
        )}
    </div>
  )
}
