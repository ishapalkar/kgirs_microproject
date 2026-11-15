import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server forwards /api to the FastAPI backend, so the app and API share one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: process.env.VITE_BACKEND ?? 'http://localhost:8000', changeOrigin: true } },
  },
})
