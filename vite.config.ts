import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        // Express compares the browser origin with the incoming Host header.
        changeOrigin: false,
      },
    },
  },
  esbuild: { jsx: 'automatic' },
  build: { chunkSizeWarningLimit: 800 },
});
