import * as THREE from 'three'
import { SimulationScheduler } from './simulationScheduler'

/**
 * @typedef {Object} BoundingSphere
 * @property {THREE.Vector2} center
 * @property {number} radius
 */

/**
 * @typedef {Object} SimBody
 * @property {string} id
 * @property {(dt: number) => void} update
 * @property {() => boolean} isSleeping
 * @property {() => void} wake
 * @property {(point: THREE.Vector2) => void} [wakeIfPointInside]
 * @property {() => BoundingSphere} getBoundingSphere
 */

export class SimWorld {
  /**
   * @param {SimulationScheduler} [scheduler]
   */
  constructor(scheduler) {
    this.scheduler = scheduler ?? new SimulationScheduler()
    this.bodies = new Map()
    this.previousCenters = new Map()
  }

  /**
   * @param {SimBody} body
   */
  addBody(body) {
    if (this.bodies.has(body.id)) {
      throw new Error(`Cannot add duplicate body id: ${body.id}`)
    }
    this.bodies.set(body.id, body)
    this.scheduler.addBody(body)
    this.previousCenters.set(body.id, body.getBoundingSphere().center.clone())
  }

  removeBody(id) {
    this.bodies.delete(id)
    this.scheduler.removeBody(id)
    this.previousCenters.delete(id)
  }

  step(dt) {
    for (const [id, body] of this.bodies.entries()) {
      this.previousCenters.set(id, body.getBoundingSphere().center.clone())
    }

    this.scheduler.step(dt)

    const entries = Array.from(this.bodies.values())
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const bodyA = entries[i]
        const bodyB = entries[j]
        this._checkSweep(bodyA, bodyB)
        this._checkSweep(bodyB, bodyA)
      }
    }
  }

  notifyPointer(point) {
    this.scheduler.notifyPointer(point)
  }

  clear() {
    for (const id of this.bodies.keys()) {
      this.scheduler.removeBody(id)
    }
    this.bodies.clear()
    this.previousCenters.clear()
  }

  _checkSweep(moving, target) {
    if (!target.isSleeping()) return

    const prev = this.previousCenters.get(moving.id)
    if (!prev) return

    const currentSphere = moving.getBoundingSphere()
    const targetSphere = target.getBoundingSphere()

    const intersects = this._segmentIntersectsSphere(
      prev,
      currentSphere.center,
      targetSphere.center,
      currentSphere.radius + targetSphere.radius
    )

    if (intersects) {
      target.wake()
    }
  }

  _segmentIntersectsSphere(start, end, center, radius) {
    const ab = end.clone().sub(start)
    const ac = center.clone().sub(start)

    const abLengthSq = ab.lengthSq()
    if (abLengthSq === 0) {
      return ac.lengthSq() <= radius * radius
    }

    const t = THREE.MathUtils.clamp(ac.dot(ab) / abLengthSq, 0, 1)
    const closest = start.clone().add(ab.multiplyScalar(t))
    const distanceSq = closest.distanceToSquared(center)
    return distanceSq <= radius * radius
  }
}
