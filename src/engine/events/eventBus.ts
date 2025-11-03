import type { EngineEvent } from './types'
import { validateEngineEvent } from './types'

export type Unsubscribe = () => void

type Listener = (event: EngineEvent) => void

export class EventBus {
  private listeners = new Set<Listener>()

  emit(event: EngineEvent) {
    if (!validateEngineEvent(event)) {
      // Fail fast in dev/test; ignore in production
      if (import.meta?.env?.MODE !== 'production') {
        throw new Error('Invalid EngineEvent payload: ' + JSON.stringify(event))
      }
      return
    }
    for (const fn of this.listeners) fn(event)
  }

  on(fn: Listener): Unsubscribe {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const globalEventBus = new EventBus()

