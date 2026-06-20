import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  publicDir: 'app/public',
  build: {
    outDir: 'public',
    // public/ also holds hand-maintained webapp assets (mapafondeo.html, app.js,
    // app.css, icon.svg, boat-cenital.svg). Vite would wipe them by default since
    // outDir is inside the project root — keep them safe across builds.
    emptyOutDir: false,
  },
  plugins: [
    tailwindcss(),
    react()
  ],
})
