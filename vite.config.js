import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Keep the browser origin in sync with the backend's local CORS setting.
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
});
