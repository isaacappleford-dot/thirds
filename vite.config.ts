import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { APP } from './src/config/app.ts';

/**
 * Base path. GitHub Pages serves project sites from /<repo>/, so CI sets
 * BASE_PATH=/<repo>/. Vercel/Netlify/local use "/".
 */
const base = normaliseBase(process.env.BASE_PATH ?? '/');

function normaliseBase(b: string): string {
  let out = b.trim() || '/';
  if (!out.startsWith('/')) out = `/${out}`;
  if (!out.endsWith('/')) out = `${out}/`;
  return out;
}

/** Injects the app name/description from src/config/app.ts into index.html. */
function appIdentity(): Plugin {
  return {
    name: 'app-identity',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_NAME%', APP.name)
        .replaceAll('%APP_DESCRIPTION%', APP.description)
        .replaceAll('%THEME_COLOR%', APP.themeColor);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  plugins: [
    react(),
    appIdentity(),
    mode === 'https' ? basicSsl() : null,
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/logo.svg', 'fonts/*.woff2'],
      manifest: {
        id: base,
        name: APP.name,
        short_name: APP.shortName,
        description: APP.description,
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: APP.backgroundColor,
        theme_color: APP.themeColor,
        categories: ['photo', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell, fonts, icons, the SIMD MediaPipe runtime and both models are
        // precached so the camera, guidance and looks work fully offline.
        globPatterns: [
          '**/*.{js,css,html,svg,png,woff2,webmanifest}',
          'models/*.tflite',
          'mediapipe/vision_wasm_internal.{js,wasm}',
        ],
        globIgnores: ['mediapipe/vision_wasm_nosimd_internal.*'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Older iOS (no WASM SIMD) gets the non-SIMD runtime; cache it on first use.
            urlPattern: ({ url }) => url.pathname.includes('/mediapipe/vision_wasm_nosimd_internal'),
            handler: 'CacheFirst',
            options: { cacheName: 'mediapipe-nosimd', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: ['es2020', 'safari16', 'chrome87'],
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
}));
