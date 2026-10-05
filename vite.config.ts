import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // No manual chunking: heavy screens (recharts on Progress) are split by React.lazy routes, and supabase-js plus
  // the cloud-only services load only when Supabase is configured. Manual groups pulled React into the charts
  // chunk and made it load eagerly (verified with Vite 8 / Rolldown).
  build: {
    // The entry chunk (≈700 kB, ≈215 kB gzip) is React DOM, Zod and the Meals home tab — all needed for the
    // first screen. Warn only if it grows beyond that.
    chunkSizeWarningLimit: 750,
  },
})
