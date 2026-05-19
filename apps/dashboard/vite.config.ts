import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/source.svg', 'icons/apple-touch-icon.png'],
      manifestFilename: 'manifest.webmanifest',
      // We ship a hand-written manifest.webmanifest in public/. Setting
      // manifest:false tells the plugin not to also generate one and conflict.
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        // Default precache globs catch the JS/CSS/HTML/assets bundle. We add
        // the icons explicitly so the shell renders offline too.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            // Network-first for GET /api/* with a short TTL — flaky cell
            // networks shouldn't blank the dashboard.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/(auth|tenants|bookings|services|clients|staff|schedule|settings|stats)(\/|$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bookla-api-get',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {},
  },
  server: {
    port: 5173,
  },
});
