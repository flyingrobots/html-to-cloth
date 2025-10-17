import * as THREE from 'three'

/**
 * @typedef {Object} SleepableBody
 * @property {string} id
 * @property {(dt: number) => void} update
 * @property {() => boolean} isSleeping
 * @property {() => void} wake
 * @property {(point: THREE.Vector2) => void} [wakeIfPointInside]
 */

export class SimulationScheduler {
  constructor() {
    this.bodies = new Map()
  }

  /**
   * @param {SleepableBody} body
   */
  addBody(body) {
    this.bodies.set(body.id, body)
  }

  removeBody(id) {
    this.bodies.delete(id)
  }

  wakeBody(id) {
    const body = this.bodies.get(id)
    if (!body) return
    body.wake()
  }

  notifyPointer(point) {
    for (const body of this.bodies.values()) {
      if (!body.isSleeping()) continue
      if (body.wakeIfPointInside) {
        body.wakeIfPointInside(point)
      }
    }
  }

  step(dt) {
    for (const body of this.bodies.values()) {
      if (body.isSleeping()) continue
      body.update(dt)
    }
  }

  clear() {
    this.bodies.clear()
  }
}
