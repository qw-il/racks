# Racks — personal wardrobe assistant

A modern, installable-feeling web app for managing your clothes, styling outfits and planning what to wear.
Everything runs **in your browser**: photos never leave your device.

## Features

### Digital wardrobe
- **Add clothes** by uploading photos (multi-select or drag-and-drop) or taking a picture with your phone's camera.
- **Automatic background removal** with an on-device AI model (`briaai/RMBG-1.4` via Transformers.js), run in a Web Worker so the UI stays smooth. Uses WebGPU when available, WebAssembly otherwise.
- **Automatic categorisation**: a zero-shot CLIP model (`Xenova/clip-vit-base-patch32`) recognises ~40 garment types (t-shirt, jeans, sneakers, blazer, handbag…) and files each piece under Tops, Bottoms, Dresses, Outerwear, Shoes, Bags or Accessories.
- Auto-detected **dominant colour** and a generated name (e.g. "Navy Blazer").
- Filter by category, search, sort by most/least worn, favourites, and edit anything the AI got wrong.
- **Works offline too**: if the models can't download, a built-in flood-fill cut-out (best on plain backgrounds) and a silhouette-based category guess are used instead, and the piece is flagged "Check category".

### Outfit builder
- Tap pieces to drop them onto a mood-board canvas; each category lands in a sensible spot (tops above bottoms, shoes at the bottom, etc.).
- Drag to arrange, pinch or scroll-wheel to resize, rotate, and layer forward/back.
- **Shuffle** generates a random outfit from your wardrobe.
- Save, rename, duplicate and delete looks.

### Outfit calendar
- Month view with each day showing the planned/worn outfit; swipe or use the arrows to change months.
- Plan a saved look for any day, or start a new outfit directly from a date.
- Wear tracking feeds back into the wardrobe ("Worn 3×") and a "Give these some love" list of items not worn in 30 days.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Build for production with `npm run build` (output in `dist/`).

The first photo you add downloads the AI models (~45 MB for background removal and ~90 MB for categorisation). They are cached by the browser, so later photos are processed quickly, and offline.

## Tech
React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion (animations) · Transformers.js (on-device ML) · IndexedDB via idb-keyval (storage).

> Note: the RMBG-1.4 model is licensed for non-commercial use. Swap the model ID in `src/lib/ai.worker.ts` if you need a commercial licence.
