import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { cloudflareTest } from '@cloudflare/vitest-plugin'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue()],
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/__tests__/*.spec.ts'],
        },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
        test: {
          name: 'server',
          include: ['server/**/__tests__/*.test.ts'],
        },
      },
    ],
  },
})
