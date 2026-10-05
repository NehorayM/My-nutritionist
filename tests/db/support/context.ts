import type { LocalStackEnv } from './localStack.ts'

/** A throwaway user created by the global setup (deleted again in its teardown). */
export interface TestUser {
  id: string
  email: string
  /** Session JWT from a real password sign-in. */
  accessToken: string
}

export interface DbTestContext {
  env: LocalStackEnv
  userA: TestUser
  userB: TestUser
}

declare module 'vitest' {
  export interface ProvidedContext {
    dbTest: DbTestContext
  }
}
