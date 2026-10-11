import type { ChannelLike } from '../dataEvents'

/** Two connected BroadcastChannel stand-ins (like two tabs): a message posted on one reaches only the other, asynchronously. */
export function createChannelPair(): [ChannelLike, ChannelLike] {
  const make = () => {
    const listeners = new Set<(event: MessageEvent) => void>()
    let peer: { deliver: (data: unknown) => void } | null = null
    let closed = false
    const end = {
      deliver: (data: unknown) => {
        if (closed) return
        for (const listener of [...listeners]) listener(new MessageEvent('message', { data: structuredClone(data) }))
      },
      channel: {
        postMessage: (message: unknown) => {
          const target = peer
          queueMicrotask(() => target?.deliver(message))
        },
        addEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => listeners.add(listener),
        removeEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => listeners.delete(listener),
        close: () => {
          closed = true
          listeners.clear()
        },
      } satisfies ChannelLike,
      connect: (other: { deliver: (data: unknown) => void }) => {
        peer = other
      },
    }
    return end
  }
  const a = make()
  const b = make()
  a.connect(b)
  b.connect(a)
  return [a.channel, b.channel]
}
