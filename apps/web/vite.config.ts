// https://vite.dev/config/
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5873,
    // Fail if 5873 is taken instead of silently moving to 5874: a second dev
    // server left running would otherwise go unnoticed.
    strictPort: true,

    // The app calls relative URLs (`fetch('/api/health')`) and Vite forwards
    // /api/* to the API. The browser sees a single origin, so development needs
    // no CORS setup and no API host in the code; production will serve both
    // from one domain to keep the same contract.
    proxy: {
      '/api': {
        target: 'http://localhost:3700',
        changeOrigin: true,
      },
    },
  },
});
