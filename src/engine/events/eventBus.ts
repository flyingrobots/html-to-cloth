import type { EngineEvent } from './types'
import { validateEngineEvent } from './types'

export type Unsubscribe = () => void

type Listener = (event: EngineEvent) => void

export class EventBus {
  private listeners = new Set<Listener>()

  emit(event: EngineEvent) {
    if (!validateEngineEvent(event)) {
      // Fail fast in dev/test; ignore in production
      let isProd = false
      if (typeof process !== 'undefined' && process && typeof process.env === 'object') {
        isProd = process.env.NODE_ENV === 'production'
      } else if (typeof import.meta !== 'undefined') {
        const im = import.meta as unknown as { env?: { MODE?: string } }
        isProd = im?.env?.MODE === 'production'
      }
      if (!isProd) {
        throw new Error('Invalid EngineEvent payload: ' + JSON.stringify(event))
      }
      return
    }
    for (const fn of this.listeners) {
      try {
        const result = fn(event)
        // handle async listeners
        const maybePromise = result as unknown as PromiseLike<unknown> | undefined
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(() => {}).catch((err) => console.error('EventBus listener promise error:', err))
        }
      } catch (err) {
        console.error('EventBus listener error:', err)
      }
    }
  }

  on(fn: Listener): Unsubscribe {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const globalEventBus = new EventBus()
