import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
const webPort = Number(process.env.WEB_PORT || 5190);
const apiPort = Number(process.env.API_PORT || 3001);

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true
      }
    }
  },
});
