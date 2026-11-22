import { uid } from './store'
import type { Category } from './types'

export interface ProcessResult {
  blob: Blob
  color: string
  guess: { type: string; category: Category; confidence: number } | null
  bgMethod: 'ai' | 'basic' | 'none'
}

type Listener = (stage: string, progress?: number) => void

let worker: Worker | null = null
const pending = new Map<string, { resolve: (r: ProcessResult) => void; reject: (e: Error) => void; onStatus: Listener }>()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev) => {
      const m = ev.data
      const p = pending.get(m.id)
      if (!p) return
      if (m.type === 'status') p.onStatus(m.stage, m.progress)
      else if (m.type === 'done') {
        pending.delete(m.id)
        p.resolve({ blob: m.blob, color: m.color, guess: m.guess, bgMethod: m.bgMethod })
      } else if (m.type === 'error') {
        pending.delete(m.id)
        p.reject(new Error(m.message))
      }
    }
  }
  return worker
}

/** Remove background, crop, detect colour and guess the category — all on-device, off the main thread. */
let queue: Promise<unknown> = Promise.resolve()
export function processPhoto(blob: Blob, opts: { removeBg: boolean }, onStatus: Listener): Promise<ProcessResult> {
  const run = () => {
    const id = uid()
    return new Promise<ProcessResult>((resolve, reject) => {
      pending.set(id, { resolve, reject, onStatus })
      getWorker().postMessage({ id, blob, removeBg: opts.removeBg })
    })
  }
  // One photo at a time keeps memory in check and the models warm
  const next = queue.then(run, run)
  queue = next.catch(() => {})
  return next
}
