import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/last-chance/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "screenshot-mobile.svg"],
      manifest: {
        id: "/last-chance/",
        name: "Last Chance",
        short_name: "Last Chance",
        description: "Evidence-based fat-loss planner",
        theme_color: "#111111",
        background_color: "#F5F5F7",
        display: "standalone",
        orientation: "portrait",
        start_url: "/last-chance/",
        scope: "/last-chance/",
        categories: ["health", "fitness", "lifestyle"],
        icons: [
          {
            src: "/last-chance/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ],
        screenshots: [
          {
            src: "/last-chance/screenshot-mobile.svg",
            sizes: "390x844",
            type: "image/svg+xml",
            form_factor: "narrow"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json}"],
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: true
      }
    })
  ]
});
