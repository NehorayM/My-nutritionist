import { randomUUID } from 'node:crypto'
import type { TestProject } from 'vitest/node'
import './context.ts'
import { createAdminClient, createAnonClient } from './clients.ts'
import type { TestUser } from './context.ts'
import { readLocalStackEnv, type LocalStackEnv } from './localStack.ts'

/**
 * Creates two confirmed users through the Auth admin API (secret key, test-only) and signs each one in with
 * a password ONCE per run (keeps well below the local sign-in rate limit). The teardown deletes them, which
 * also cascades to every row they own.
 */
export async function createSignedInUser(env: LocalStackEnv, label: string): Promise<TestUser> {
  const admin = createAdminClient(env)
  const email = `db-test-${label}-${randomUUID()}@my-nutritionist.test`
  const password = `pw-${randomUUID()}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) {
    throw new Error(`Could not create test user ${label}: ${created.error?.message ?? 'no user returned'}`)
  }
  const signedIn = await createAnonClient(env).auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.session) {
    await admin.auth.admin.deleteUser(created.data.user.id)
    throw new Error(`Could not sign in test user ${label}: ${signedIn.error?.message ?? 'no session returned'}`)
  }
  return { id: created.data.user.id, email, accessToken: signedIn.data.session.access_token }
}

export async function deleteUsers(env: LocalStackEnv, ids: readonly string[]): Promise<void> {
  const admin = createAdminClient(env)
  const results = await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)))
  const failed = results.filter((result) => result.error !== null)
  if (failed.length > 0) {
    throw new Error(`Could not delete ${failed.length} test user(s): ${failed[0]?.error?.message ?? ''}`)
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const env = readLocalStackEnv()
  const userA = await createSignedInUser(env, 'a')
  let userB: TestUser
  try {
    userB = await createSignedInUser(env, 'b')
  } catch (error) {
    await deleteUsers(env, [userA.id])
    throw error
  }
  project.provide('dbTest', { env, userA, userB })
  return async () => {
    await deleteUsers(env, [userA.id, userB.id])
  }
}
