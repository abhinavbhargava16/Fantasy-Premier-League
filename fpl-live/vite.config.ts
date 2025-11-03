import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Understat analytics endpoints (local server)
      '/api/xg': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/api/team': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      // FPL official API endpoints
      '/api': {
        target: 'https://fantasy.premierleague.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})
