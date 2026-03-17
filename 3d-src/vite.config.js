import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../3d',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/window3d.js',
        chunkFileNames: 'assets/window3d-[hash].js',
        assetFileNames: 'assets/window3d[extname]'
      }
    }
  }
})
