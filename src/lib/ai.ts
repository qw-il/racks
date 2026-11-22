import { uid } from './store'
import type { Category } from './types'

export interface ProcessResult {
  blob: Blob
  color: string
  guess: { type: string; category: Category; confidence: number } | null
  bgMethod: 'ai' | 'basic' | 'none'
  /** Why an AI step fell back, if it did */
  notes: string[]
}

type Listener = (stage: string, progress?: number) => void
interface Job {
  resolve: (r: ProcessResult) => void
  reject: (e: Error) => void
  onStatus: Listener
  lastHeard: number
}

let worker: Worker | null = null
const pending = new Map<string, Job>()

function failAll(message: string) {
  for (const [id, job] of pending) {
    pending.delete(id)
    job.reject(new Error(message))
  }
  worker?.terminate()
  worker = null // a fresh worker is created for the next photo
}

function getWorker() {
  if (!worker) {
    try {
      worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) {
      throw new Error(`Couldn’t start the photo processor: ${e instanceof Error ? e.message : e}`)
    }
    worker.onerror = (e) => {
      console.error('[racks] worker error', e)
      failAll(`Photo processor crashed${e.message ? `: ${e.message}` : ''}`)
    }
    worker.onmessageerror = () => failAll('Photo processor sent an unreadable message')
    worker.onmessage = (ev) => {
      const m = ev.data
      const p = pending.get(m.id)
      if (!p) return
      p.lastHeard = Date.now()
      if (m.type === 'status') p.onStatus(m.stage, m.progress)
      else if (m.type === 'done') {
        pending.delete(m.id)
        p.resolve({ blob: m.blob, color: m.color, guess: m.guess, bgMethod: m.bgMethod, notes: m.notes ?? [] })
      } else if (m.type === 'error') {
        pending.delete(m.id)
        p.reject(new Error(m.message))
      }
    }
  }
  return worker
}

// Safety net: if a job hears nothing from the worker for 3 minutes, give up on it.
setInterval(() => {
  for (const [, job] of pending) {
    if (Date.now() - job.lastHeard > 180_000) {
      failAll('Processing timed out — please try again')
      return
    }
  }
}, 5000)

let queue: Promise<unknown> = Promise.resolve()

/** Remove background, crop, detect colour and guess the category — all on-device, off the main thread. */
export function processPhoto(blob: Blob, opts: { removeBg: boolean }, onStatus: Listener): Promise<ProcessResult> {
  const run = () => {
    const id = uid()
    return new Promise<ProcessResult>((resolve, reject) => {
      pending.set(id, { resolve, reject, onStatus, lastHeard: Date.now() })
      try {
        getWorker().postMessage({ id, blob, removeBg: opts.removeBg })
      } catch (e) {
        pending.delete(id)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }
  // One photo at a time keeps memory in check and the models warm
  const next = queue.then(run, run)
  queue = next.catch(() => {})
  return next
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i
/** Browsers sometimes leave `type` empty (e.g. HEIC on Windows), so fall back to the extension. */
export const isImageFile = (f: File) => f.type.startsWith('image/') || (!f.type && IMAGE_EXT.test(f.name))
