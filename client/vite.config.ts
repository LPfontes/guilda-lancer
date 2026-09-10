import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('compcon-pt-br.json')) {
            return 'lancer-data';
          }
          if (id.includes('node_modules')) {
            if (id.includes('socket.io-client')) {
              return 'vendor-socket';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
