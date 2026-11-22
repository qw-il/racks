import type { Placement } from '../lib/types'
import { useStore } from '../lib/store'
import { cx } from './ui'

/** Static render of an outfit's layout — scales to whatever box it's placed in. */
export function OutfitPreview({ placements, className }: { placements: Placement[]; className?: string }) {
  const images = useStore((s) => s.images)
  return (
    <div className={cx('relative aspect-[3/4] w-full overflow-hidden', className)} style={{ containerType: 'inline-size' }}>
      {[...placements]
        .sort((a, b) => a.z - b.z)
        .map((p) =>
          images[p.itemId] ? (
            <img
              key={p.itemId}
              src={images[p.itemId]}
              alt=""
              draggable={false}
              className="absolute cutout pointer-events-none"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.w * 100}%`,
                transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
              }}
            />
          ) : null,
        )}
    </div>
  )
}
