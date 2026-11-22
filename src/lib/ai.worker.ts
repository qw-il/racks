/// <reference lib="webworker" />
import { AutoModel, AutoProcessor, RawImage, env, pipeline, type PreTrainedModel, type Processor } from '@huggingface/transformers'
import { CLOTHING_TYPES } from './categories'
import { downscale, heuristicRemoveBackground, trimAndAnalyse } from './image'

env.allowLocalModels = false

const ctx = self as unknown as DedicatedWorkerGlobalScope

/*
 * Models run on WebAssembly with 8-bit quantised weights. This is the most reliable
 * path across browsers and keeps the one-time download small:
 *   background removal  briaai/RMBG-1.4            ~44 MB
 *   categorisation      Xenova/clip-vit-base-patch32 ~150 MB
 * (WebGPU builds of these are fp16/fp32 and several times larger.)
 */
const DTYPE = 'q8' as const
const DEVICE = 'wasm' as const

/** Jobs are processed one at a time, so status messages always belong to the current job. */
let currentId = ''
function status(stage: string, progress?: number) {
  ctx.postMessage({ type: 'status', id: currentId, stage, progress })
}

/** Tracks download progress across model files and remembers when we last heard anything. */
class Download {
  files = new Map<string, { loaded: number; total: number }>()
  last = Date.now()
  constructor(public label: string) {}
  callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    this.last = Date.now()
    if (p.status === 'progress' && p.file && p.total) {
      this.files.set(p.file, { loaded: p.loaded ?? 0, total: p.total })
      let l = 0, t = 0
      for (const f of this.files.values()) { l += f.loaded; t += f.total }
      const mb = (t / 1e6).toFixed(0)
      status(`${this.label} (one-time, ${mb} MB)`, t ? l / t : undefined)
    }
  }
}

/** Reject if `dl` makes no progress for `ms`, so a stalled download can't hang the queue forever. */
function watchdog<T>(p: Promise<T>, dl: Download, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (Date.now() - dl.last > ms) {
        clearInterval(t)
        reject(new Error(`${what} stalled (no network progress for ${ms / 1000}s)`))
      }
    }, 2000)
    p.then((v) => (clearInterval(t), resolve(v)), (e) => (clearInterval(t), reject(e)))
  })
}

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))])
}

/** Turn low-level errors into something a person can act on. */
function explain(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|networkerror|load failed|err_/i.test(msg))
    return 'couldn’t download the AI model from huggingface.co (check your internet connection, ad-blocker or firewall)'
  return msg
}

/** After a model fails, don't retry it on every photo — wait a few minutes. */
const unavailableUntil: Record<string, number> = {}
const available = (k: string) => (unavailableUntil[k] ?? 0) < Date.now()
const markUnavailable = (k: string) => (unavailableUntil[k] = Date.now() + 5 * 60_000)

// ---------- Background removal ----------
let segmenter: Promise<{ model: PreTrainedModel; processor: Processor }> | null = null
function getSegmenter() {
  if (!segmenter) {
    const dl = new Download('Downloading background-removal model')
    status('Loading background-removal model…')
    segmenter = watchdog(
      (async () => {
        const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
          config: { model_type: 'custom' } as never,
          device: DEVICE,
          dtype: DTYPE,
          progress_callback: dl.callback as never,
        })
        const processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
          config: {
            do_normalize: true,
            do_pad: false,
            do_rescale: true,
            do_resize: true,
            image_mean: [0.5, 0.5, 0.5],
            feature_extractor_type: 'ImageFeatureExtractor',
            image_std: [1, 1, 1],
            resample: 2,
            rescale_factor: 0.00392156862745098,
            size: { width: 1024, height: 1024 },
          } as never,
        })
        return { model, processor }
      })(),
      dl,
      60_000,
      'Background-removal model download',
    )
    segmenter.catch(() => (segmenter = null))
  }
  return segmenter
}

/** Fraction of pixels that ended up opaque — used to reject empty/failed masks. */
function opaqueFraction(img: RawImage) {
  const d = img.data
  let n = 0
  for (let i = 3; i < d.length; i += 16) if (d[i] > 128) n++
  return n / (d.length / 16)
}

async function aiRemoveBackground(blob: Blob): Promise<Blob> {
  const { model, processor } = await getSegmenter()
  status('Removing background…')
  const image = await RawImage.fromBlob(blob)
  const run = async () => {
    const { pixel_values } = await processor(image)
    const { output } = await model({ input: pixel_values })
    return RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height)
  }
  const mask = await timeout(run(), 120_000, 'Background removal')
  const rgba = image.rgba()
  rgba.putAlpha(mask)
  const f = opaqueFraction(rgba)
  if (f < 0.02) throw new Error('Model found no garment in the photo')
  return (await rgba.toBlob('image/png')) as Blob
}

// ---------- Categorisation ----------
type Classifier = (img: RawImage, labels: string[], opts: object) => Promise<{ label: string; score: number }[]>
let classifier: Promise<Classifier> | null = null
function getClassifier() {
  if (!classifier) {
    const dl = new Download('Downloading categorisation model')
    status('Loading categorisation model…')
    classifier = watchdog(
      pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
        device: DEVICE,
        dtype: DTYPE,
        progress_callback: dl.callback as never,
      }) as unknown as Promise<Classifier>,
      dl,
      60_000,
      'Categorisation model download',
    )
    classifier.catch(() => (classifier = null))
  }
  return classifier
}

async function onWhite(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(bmp, 0, 0)
  bmp.close()
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
}

async function classify(blob: Blob) {
  const clf = await getClassifier()
  status('Recognising item…')
  const image = await RawImage.fromBlob(await onWhite(blob))
  const labels = Object.keys(CLOTHING_TYPES)
  const res = await timeout(clf(image, labels, { hypothesis_template: 'a product photo of a {}' }), 60_000, 'Recognition')
  const top = res[0]
  return { type: top.label, category: CLOTHING_TYPES[top.label], confidence: top.score }
}

// ---------- Message handling ----------
ctx.onmessage = async (ev: MessageEvent<{ id: string; blob: Blob; removeBg: boolean }>) => {
  const { id, blob, removeBg } = ev.data
  currentId = id
  const notes: string[] = []
  try {
    status('Preparing photo…')
    let small: Blob
    try {
      small = await downscale(blob, 1024)
    } catch {
      const heic = /heic|heif/i.test(blob.type)
      throw new Error(
        heic
          ? 'This browser can’t read HEIC photos. On iPhone: Settings → Camera → Formats → Most Compatible, or export as JPEG.'
          : 'Couldn’t read this image file. Try a JPEG or PNG.',
      )
    }

    let cutout: Blob = small
    let bgMethod: 'ai' | 'basic' | 'none' = 'none'
    if (removeBg) {
      try {
        if (!available('bg')) throw new Error('skipped (model unavailable)')
        cutout = await aiRemoveBackground(small)
        bgMethod = 'ai'
      } catch (e) {
        const msg = explain(e)
        console.warn('[racks] AI background removal failed, using basic fallback:', e)
        if (!/no garment/.test(msg)) markUnavailable('bg')
        // Both models come from the same host — if this one couldn't download, don't make the user wait for the other.
        if (/stalled|download/.test(msg)) markUnavailable('clf')
        notes.push(`AI background removal unavailable: ${msg}`)
        status('Removing background (basic)…')
        cutout = await heuristicRemoveBackground(small)
        bgMethod = 'basic'
      }
    }

    let { blob: trimmed, color, aspect } = await trimAndAnalyse(cutout)
    // If the cut-out came back (nearly) empty, keep the original photo instead.
    if (trimmed === cutout && bgMethod !== 'none') {
      ;({ blob: trimmed, color, aspect } = await trimAndAnalyse(small))
      bgMethod = 'none'
    }

    let guess: { type: string; category: string; confidence: number } | null = null
    try {
      if (!available('clf')) throw new Error('skipped — AI models can’t be reached right now')
      guess = await classify(trimmed)
    } catch (e) {
      console.warn('[racks] Categorisation failed, guessing from shape:', e)
      markUnavailable('clf')
      notes.push(`AI categorisation unavailable: ${explain(e)}`)
      const category = aspect > 1.5 ? 'shoes' : aspect < 0.62 ? 'bottoms' : 'tops'
      guess = { type: category, category, confidence: 0 }
    }

    ctx.postMessage({ type: 'done', id, blob: trimmed, color, guess, bgMethod, notes })
  } catch (e) {
    ctx.postMessage({ type: 'error', id, message: e instanceof Error ? e.message : String(e) })
  }
}
