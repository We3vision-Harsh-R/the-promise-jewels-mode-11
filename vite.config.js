import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite does not run as its own server any more. The Express app in
// server/src/server.ts loads this config and mounts Vite in middleware mode, so
// the website, the admin panel and the API are all served by one node process
// on one port. That also means no dev proxy is needed: /api/v1 is same-origin,
// and the HttpOnly auth cookies are sent without any CORS setup.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Absolute imports from src. Folder moves no longer mean rewriting a
      // trail of ../../.. across dozens of files.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
