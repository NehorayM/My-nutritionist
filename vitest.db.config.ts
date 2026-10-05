import { defineConfig } from 'vitest/config'

/**
 * Backend tests (`npm run test:db`), separate from the jsdom app suite (vitest.config.ts).
 *
 * - `edge-functions`: unit tests of the `food-search` Edge Function modules with a fake upstream (no network).
 * - `db`: security/RLS/constraint tests against the LOCAL Supabase stack (`npm run db:start`). The global setup
 *   reads the API URL and keys from `supabase status -o env` at runtime (never from repo files), creates two
 *   throwaway users through the Auth admin API, signs them in with a password and deletes them afterwards.
 *   Files run one at a time because they share those users.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'edge-functions',
          environment: 'node',
          include: ['tests/db/functions/**/*.test.ts'],
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/*.test.ts'],
          globalSetup: ['tests/db/support/globalSetup.ts'],
          fileParallelism: false,
          sequence: { concurrent: false },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
