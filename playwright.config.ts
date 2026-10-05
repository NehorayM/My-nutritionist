import { execFileSync } from 'node:child_process'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in the system Google Chrome (no browser download).
 * - guest: dev server with NO Supabase variables → Offline/Local mode.
 * - cloud: dev server pointed at the LOCAL Supabase stack (`npm run db:start`); the URL and publishable key are
 *   read from `supabase status` at runtime. The project is skipped when the stack isn't running.
 */
const GUEST_PORT = 5191
const CLOUD_PORT = 5192

function localSupabase(): { url: string; key: string } | null {
  try {
    const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const read = (name: string) => new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm').exec(out)?.[1] ?? null
    const url = read('API_URL')
    const key = read('PUBLISHABLE_KEY')
    return url && key ? { url, key } : null
  } catch {
    return null
  }
}

const supabase = localSupabase()
const chrome = { ...devices['Pixel 7'], channel: 'chrome' as const }

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'guest', testMatch: /guest\..*spec\.ts/, use: { ...chrome, baseURL: `http://localhost:${GUEST_PORT}` } },
    ...(supabase
      ? [{ name: 'cloud', testMatch: /cloud\..*spec\.ts/, use: { ...chrome, baseURL: `http://localhost:${CLOUD_PORT}` } }]
      : []),
  ],
  webServer: [
    {
      command: `npx vite --port ${GUEST_PORT} --strictPort`,
      port: GUEST_PORT,
      reuseExistingServer: false,
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' },
    },
    ...(supabase
      ? [
          {
            command: `npx vite --port ${CLOUD_PORT} --strictPort`,
            port: CLOUD_PORT,
            reuseExistingServer: false,
            env: { VITE_SUPABASE_URL: supabase.url, VITE_SUPABASE_PUBLISHABLE_KEY: supabase.key },
          },
        ]
      : []),
  ],
})
