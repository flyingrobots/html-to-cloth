// src/engine/world.js
// Modernized from the caverns engine world abstraction

/**
 * Represents the simulation world. Systems can be registered with a priority and
 * pause behaviour. Each tick the world forwards the timestep to active systems
 * in priority order.
 */
export class EngineWorld {
  constructor() {
    /** @type {Array<{system: EngineSystem, priority: number, pauseable: boolean}>} */
    this._entries = []
    this._systems = new Set()
    this._time = 0
  }

  /**
   * @param {EngineSystem} system
   * @param {{ priority?: number, pauseable?: boolean }} [options]
   */
  addSystem(system, options = {}) {
    if (this._systems.has(system)) {
      return
    }
    const entry = {
      system,
      priority: options.priority ?? 0,
      pauseable: options.pauseable ?? true,
    }
    this._entries.push(entry)
    this._entries.sort((a, b) => b.priority - a.priority)
    this._systems.add(system)
    system.onAdded?.(this)
  }

  /**
   * @param {EngineSystem} system
   */
  removeSystem(system) {
    if (!this._systems.has(system)) return
    this._entries = this._entries.filter((entry) => entry.system !== system)
    this._systems.delete(system)
    system.onRemoved?.(this)
  }

  /**
   * Advance the world by a timestep.
   * @param {number} dt Seconds
   * @param {{ paused?: boolean }} [options]
   */
  tick(dt, options = {}) {
    const paused = options.paused ?? false
    this._time += dt
    for (const entry of this._entries) {
      if (paused && entry.pauseable) continue
      entry.system.update?.(dt, { paused })
    }
  }

  get time() {
    return this._time
  }
}

/**
 * @typedef {Object} EngineSystem
 * @property {(world: EngineWorld) => void} [onAdded]
 * @property {(world: EngineWorld) => void} [onRemoved]
 * @property {(dt: number, context: { paused: boolean }) => void} [update]
 */
