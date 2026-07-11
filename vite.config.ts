import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  // Self-signed HTTPS: getUserMedia requires a secure context, so testing on
  // a physical phone over the LAN needs https. `host: true` exposes the dev
  // server on the local network.
  plugins: [react(), basicSsl()],
  server: {
    host: true,
  },
  test: {
    environment: 'jsdom',
  },
});
