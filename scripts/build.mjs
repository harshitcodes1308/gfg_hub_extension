// Builds the MV3 extension into dist/ with three Vite passes:
//   1. popup      — React HTML page (relative asset paths for the extension context)
//   2. service-worker — single self-contained IIFE
//   3. content-script — single self-contained IIFE (content scripts can't be ES modules)
// Then copies manifest.json + public/ (icons) into dist/.
// One command (`npm run build`), zero extra build dependencies beyond Vite itself.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cpSync, existsSync } from 'node:fs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const r = (...p) => resolve(root, ...p);

// 1. Popup (React). emptyOutDir:true cleans dist before the other passes append to it.
await build({
  root: r('src/popup'),
  base: './',
  plugins: [react()],
  build: {
    outDir: dist,
    emptyOutDir: true,
    rollupOptions: {
      input: r('src/popup/popup.html'),
      output: { entryFileNames: 'popup.js', assetFileNames: 'popup.[ext]' },
    },
  },
});

// Shared config for the two IIFE bundles (no React, no external deps).
const iife = (entry, fileName, name) =>
  build({
    build: {
      outDir: dist,
      emptyOutDir: false,
      lib: { entry: r(entry), formats: ['iife'], name, fileName: () => fileName },
    },
  });

// 2. Background service worker.
await iife('src/background/service-worker.ts', 'service-worker.js', 'GFGHubServiceWorker');

// 3. Content script.
await iife('src/content/content-script.ts', 'content-script.js', 'GFGHubContent');

// 4. Static files.
cpSync(r('manifest.json'), resolve(dist, 'manifest.json'));
if (existsSync(r('public'))) cpSync(r('public'), dist, { recursive: true });

console.log('\n✓ Built extension to dist/  — load it via chrome://extensions → Load unpacked → dist/');
