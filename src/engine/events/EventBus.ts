export type EngineEvent = {
  type: string
  time: number
  id?: string
  tag?: string | null
  payload?: Record<string, unknown>
}

export class EventBus {
  private listeners = new Set<(e: EngineEvent) => void>()

  post(event: EngineEvent) {
    const e = { ...event, time: event.time ?? Date.now() }
    for (const fn of this.listeners) fn(e)
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('engineEvent', { detail: e }))
      }
    } catch {
      // ignore window dispatch issues
    }
  }

  subscribe(fn: (e: EngineEvent) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
