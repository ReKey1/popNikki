import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url)))

  return {
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
          plugins: [
            cloudflareTest({
              wrangler: { configPath: './wrangler.jsonc' },
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            }),
          ],
          test: {
            name: 'server',
            include: ['server/**/__tests__/*.test.ts'],
            setupFiles: ['./server/__tests__/apply-migrations.ts'],
          },
        },
        {
          test: {
            name: 'scripts',
            environment: 'node',
            include: ['scripts/**/__tests__/*.test.ts'],
          },
        },
      ],
    },
  }
})
