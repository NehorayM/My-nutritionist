/**
 * Exclusive locks across the tabs of this origin (Web Locks API), so only one tab sends a user's queued
 * changes at a time. Without it, two tabs could send versions of one record concurrently and the older one
 * could arrive last. Where the API is missing, the task simply runs (single-tab behaviour).
 */
export type LockRunner = <T>(name: string, task: () => Promise<T>) => Promise<T>

export const browserLock: LockRunner = (name, task) => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  return locks ? locks.request(name, task) : task()
}

/** In-memory equivalent for tests: tasks with the same name run one after another, in request order. */
export function createMemoryLock(): LockRunner {
  const tails = new Map<string, Promise<unknown>>()
  return <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const previous = tails.get(name) ?? Promise.resolve()
    const run = previous.then(task, task)
    const tail = run.catch(() => undefined)
    tails.set(name, tail)
    void tail.then(() => {
      if (tails.get(name) === tail) tails.delete(name)
    })
    return run
  }
}

export function syncLockName(userId: string): string {
  return `my-nutritionist:sync:${userId}`
}
