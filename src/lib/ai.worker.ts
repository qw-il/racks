/// <reference lib="webworker" />
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
  pipeline,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'
import { CLOTHING_TYPES } from './categories'
import { downscale, heuristicRemoveBackground, trimAndAnalyse } from './image'

env.allowLocalModels = false

const ctx = self as unknown as DedicatedWorkerGlobalScope
type Device = 'webgpu' | 'wasm'

let device: Device = 'wasm'
const hasWebGPU = async () => {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return !!(gpu && (await gpu.requestAdapter()))
  } catch {
    return false
  }
}
const deviceReady = hasWebGPU().then((ok) => (device = ok ? 'webgpu' : 'wasm'))

function status(id: string, stage: string, progress?: number) {
  ctx.postMessage({ type: 'status', id, stage, progress })
}

function progressFor(id: string, stage: string) {
  const files = new Map<string, { loaded: number; total: number }>()
  return (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.file && p.total) {
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total })
      let l = 0, t = 0
      for (const f of files.values()) { l += f.loaded; t += f.total }
      status(id, stage, t ? l / t : undefined)
    }
  }
}

// ---------- Background removal (briaai/RMBG-1.4) ----------
let segmenter: Promise<{ model: PreTrainedModel; processor: Processor }> | null = null
function getSegmenter(id: string) {
  if (!segmenter) {
    segmenter = (async () => {
      await deviceReady
      const load = (dev: Device) =>
        AutoModel.from_pretrained('briaai/RMBG-1.4', {
          config: { model_type: 'custom' } as never,
          device: dev,
          dtype: dev === 'webgpu' ? 'fp16' : 'q8',
          progress_callback: progressFor(id, 'Downloading background-removal model') as never,
        })
      let model: PreTrainedModel
      try {
        model = await load(device)
      } catch (e) {
        if (device !== 'webgpu') throw e
        device = 'wasm'
        model = await load('wasm')
      }
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
    })()
    segmenter.catch(() => (segmenter = null))
  }
  return segmenter
}

async function aiRemoveBackground(id: string, blob: Blob): Promise<Blob> {
  const { model, processor } = await getSegmenter(id)
  status(id, 'Removing background…')
  const image = await RawImage.fromBlob(blob)
  const { pixel_values } = await processor(image)
  const { output } = await model({ input: pixel_values })
  const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height)
  const rgba = image.rgba()
  rgba.putAlpha(mask)
  return (await rgba.toBlob('image/png')) as Blob
}

// ---------- Categorisation (CLIP zero-shot) ----------
type Classifier = (img: RawImage, labels: string[], opts: object) => Promise<{ label: string; score: number }[]>
let classifier: Promise<Classifier> | null = null
function getClassifier(id: string) {
  if (!classifier) {
    classifier = (async () => {
      await deviceReady
      const load = (dev: Device) =>
        pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
          device: dev,
          dtype: dev === 'webgpu' ? 'fp32' : 'q8',
          progress_callback: progressFor(id, 'Downloading categorisation model') as never,
        })
      try {
        return (await load(device)) as unknown as Classifier
      } catch (e) {
        if (device !== 'webgpu') throw e
        return (await load('wasm')) as unknown as Classifier
      }
    })()
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

async function classify(id: string, blob: Blob) {
  const clf = await getClassifier(id)
  status(id, 'Recognising item…')
  const image = await RawImage.fromBlob(await onWhite(blob))
  const labels = Object.keys(CLOTHING_TYPES)
  const res = await clf(image, labels, { hypothesis_template: 'a product photo of a {}' })
  const top = res[0]
  return { type: top.label, category: CLOTHING_TYPES[top.label], confidence: top.score }
}

// ---------- Message handling ----------
ctx.onmessage = async (ev: MessageEvent<{ id: string; blob: Blob; removeBg: boolean }>) => {
  const { id, blob, removeBg } = ev.data
  try {
    status(id, 'Preparing photo…')
    const small = await downscale(blob, 1024)

    let cutout: Blob = small
    let bgMethod: 'ai' | 'basic' | 'none' = 'none'
    if (removeBg) {
      try {
        cutout = await aiRemoveBackground(id, small)
        bgMethod = 'ai'
      } catch (e) {
        console.warn('[racks] AI background removal unavailable, using basic fallback', e)
        status(id, 'Removing background (basic)…')
        cutout = await heuristicRemoveBackground(small)
        bgMethod = 'basic'
      }
    }

    const { blob: trimmed, color, aspect } = await trimAndAnalyse(cutout)

    let guess: { type: string; category: string; confidence: number } | null = null
    try {
      guess = await classify(id, trimmed)
    } catch (e) {
      console.warn('[racks] Categorisation model unavailable, guessing from shape', e)
      // Rough silhouette heuristic so the item still lands somewhere sensible
      const category = aspect > 1.5 ? 'shoes' : aspect < 0.62 ? 'bottoms' : 'tops'
      guess = { type: category, category, confidence: 0 }
    }

    ctx.postMessage({ type: 'done', id, blob: trimmed, color, guess, bgMethod })
  } catch (e) {
    ctx.postMessage({ type: 'error', id, message: e instanceof Error ? e.message : String(e) })
  }
}
