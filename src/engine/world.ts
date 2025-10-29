import type { EngineLogger, EngineSystem, EngineSystemId, EngineSystemOptions } from './types'
import { DEFAULT_LOGGER } from './defaultLogger'

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
  private readonly logger: EngineLogger

  constructor(logger: EngineLogger = DEFAULT_LOGGER) {
    this.logger = logger
  }

  addSystem(system: EngineSystem, options: EngineSystemOptions = {}): EngineSystemId {
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
    return id
  }

  removeSystem(id: EngineSystemId) {
    const index = this.systems.findIndex((entry) => entry.id === id)
    if (index === -1) return

    const [entry] = this.systems.splice(index, 1)
    entry.system.onDetach?.()
  }

  /** Convenience: remove a system by instance. */
  removeSystemInstance(system: EngineSystem) {
    const index = this.systems.findIndex((entry) => entry.system === system)
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
    const paused = this.paused
    const snapshot = this.systems.slice()
    const current = new Set(this.systems)
    for (const entry of snapshot) {
      if (paused && !entry.allowWhilePaused) continue
      if (!current.has(entry)) continue
      entry.system.fixedUpdate?.(dt)
    }
  }

  frame(dt: number) {
    const snapshot = this.systems.slice()
    const current = new Set(this.systems)
    for (const entry of snapshot) {
      if (!current.has(entry)) continue
      entry.system.frameUpdate?.(dt)
    }
  }

  getLogger(): EngineLogger {
    return this.logger
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
