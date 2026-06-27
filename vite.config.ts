import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/last-chance-professionalized/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "screenshot-mobile.svg"],
      manifest: {
        id: "/last-chance-professionalized/",
        name: "Last Chance",
        short_name: "Last Chance",
        description: "Evidence-based fat-loss planner",
        theme_color: "#101114",
        background_color: "#F6F7F9",
        display: "standalone",
        orientation: "portrait",
        start_url: "/last-chance-professionalized/",
        scope: "/last-chance-professionalized/",
        categories: ["health", "fitness", "lifestyle"],
        icons: [
          {
            src: "/last-chance-professionalized/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/last-chance-professionalized/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/last-chance-professionalized/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ],
        screenshots: [
          {
            src: "/last-chance-professionalized/screenshot-mobile.svg",
            sizes: "390x844",
            type: "image/svg+xml",
            form_factor: "narrow"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json}"],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/JahelCuadrado\/ExerciseGymGifsDB@main\/.*\.(gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "last-chance-exercise-media-v1",
              expiration: {
                maxEntries: 260,
                maxAgeSeconds: 60 * 60 * 24 * 90
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ]
});
