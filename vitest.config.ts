import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // UI integration tests drive multi-step flows with user-event; under full parallel load they need more than the 5 s default.
      testTimeout: 20_000,
      // jsdom workers are CPU-heavy; leaving headroom keeps timing-sensitive UI flows stable.
      maxWorkers: '50%',
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
        reporter: ['text-summary', 'text', 'html'],
      },
    },
  }),
)
