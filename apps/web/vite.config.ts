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
    // The target is the API's HOST and PORT (apps/api/src/index.ts): 127.0.0.1, not localhost,
    // which may resolve to ::1 first, where the API does not listen.
    // ws: the live updates' WebSocket, under /api/socket.io, goes the same way.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3700',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
