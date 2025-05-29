// vite.config.js
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dotenv from 'dotenv'

// load .env in dev
dotenv.config()

// pick up the variable you set in Netlify or your local .env
const API_URL = process.env.VITE_API_URL || 'http://localhost:4000'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        past: resolve(__dirname, 'past.html')
      }
    }
  }
})
