import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      // 开发时前端 5173，后端 8787，同源由 Vite 代理
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true
  }
})
