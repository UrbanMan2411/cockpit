import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ['pdf-lib', '@pdf-lib/fontkit'],
          xlsx: ['xlsx', 'jszip'],
          dnd: ['@hello-pangea/dnd'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})
