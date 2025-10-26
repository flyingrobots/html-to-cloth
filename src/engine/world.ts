import type { EngineSystem, EngineSystemId, EngineSystemOptions } from './types'

type RegisteredSystem = {
  id: EngineSystemId
  system: EngineSystem
  priority: number
  allowWhilePaused: boolean
}

export class EngineWorld {
  private systems: RegisteredSystem[] = []
  private paused = false
  private idCounter = 0

  addSystem(system: EngineSystem, options: EngineSystemOptions = {}) {
    const id = this.resolveId(system, options)
    if (this.systems.some((entry) => entry.id === id)) {
      throw new Error(`Engine system id '${id}' already registered`)
    }
    if (this.systems.some((entry) => entry.system === system)) {
      throw new Error('Engine system instance already registered')
    }
    const entry: RegisteredSystem = {
      id,
      system,
      priority: options.priority ?? system.priority ?? 0,
      allowWhilePaused: options.allowWhilePaused ?? system.allowWhilePaused ?? false,
    }

    this.systems.push(entry)
    this.sortSystems()
    system.onAttach?.(this)
  }

  removeSystem(id: EngineSystemId) {
    const index = this.systems.findIndex((entry) => entry.id === id)
    if (index === -1) return

    const [entry] = this.systems.splice(index, 1)
    entry.system.onDetach?.()
  }

  setPaused(value: boolean) {
    this.paused = value
  }

  isPaused() {
    return this.paused
  }

  step(dt: number) {
    for (const entry of this.systems) {
      if (this.paused && !entry.allowWhilePaused) continue
      entry.system.fixedUpdate?.(dt)
    }
  }

  frame(dt: number) {
    for (const entry of this.systems) {
      entry.system.frameUpdate?.(dt)
    }
  }

  private resolveId(system: EngineSystem, options: EngineSystemOptions) {
    if (options.id) return options.id
    if (system.id) return system.id
    this.idCounter += 1
    return `system-${this.idCounter}`
  }

  private sortSystems() {
    this.systems.sort((a, b) => b.priority - a.priority)
  }
}
