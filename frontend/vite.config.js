import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// vite.config.js
export default defineConfig({
  plugins: [
    react()
  ],

  server: {
    proxy: {
      '/api': 'http://localhost:8000'
   }
  },

  json: {
    // enable named exports from JSON files like `import cities from 'world-cities'`
    namedExports: true
  }
})

