import * as THREE from 'three'
import { SimulationScheduler, type SleepableBody } from './simulationScheduler'

export type BoundingSphere = {
  center: THREE.Vector2
  radius: number
}

export interface SimBody extends SleepableBody {
  getBoundingSphere: () => BoundingSphere
  warmStart?: (config: SimWarmStartConfig) => void
  configureSleep?: (config: SimSleepConfig) => void
}

export type SimWarmStartConfig = {
  passes: number
  constraintIterations: number
}

export type SimSleepConfig = {
  velocityThreshold: number
  frameThreshold: number
}

export type SimBodySnapshot = {
  id: string
  center: { x: number; y: number }
  radius: number
  sleeping: boolean
}

export type SimWorldSnapshot = {
  bodies: SimBodySnapshot[]
}

/**
 * Manages simulated bodies participating in the cloth scene. Handles broad-phase wake checks,
 * pointer notifications, and keeps track of the previous positions required for sweep tests.
 */
export class SimWorld {
  private scheduler: SimulationScheduler
  private bodies = new Map<string, SimBody>()
  private previousCenters = new Map<string, { x: number; y: number }>()
  private snapshot: SimWorldSnapshot = { bodies: [] }

  constructor(scheduler?: SimulationScheduler) {
    this.scheduler = scheduler ?? new SimulationScheduler()
  }

  /** Registers a body with the internal scheduler and snapshot state. */
  addBody(body: SimBody) {
    if (this.bodies.has(body.id)) {
      throw new Error(`Cannot add duplicate body id: ${body.id}`)
    }
    this.bodies.set(body.id, body)
    this.scheduler.addBody(body)
    const sphere = body.getBoundingSphere()
    this.previousCenters.set(body.id, { x: sphere.center.x, y: sphere.center.y })
    this.updateSnapshot()
  }

  /** Removes a body and its bookkeeping data. */
  removeBody(id: string) {
    this.bodies.delete(id)
    this.scheduler.removeBody(id)
    this.previousCenters.delete(id)
    this.updateSnapshot()
  }

  hasBody(id: string) {
    return this.bodies.has(id)
  }

  /** Advances all awake bodies and performs sleeping-body sweep tests. */
  step(dt: number) {
    for (const [id, body] of this.bodies.entries()) {
      const sphere = body.getBoundingSphere()
      this.previousCenters.set(id, { x: sphere.center.x, y: sphere.center.y })
    }

    this.scheduler.step(dt)

    const entries = Array.from(this.bodies.values())
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const bodyA = entries[i]
        const bodyB = entries[j]
        this.checkSweep(bodyA, bodyB)
        this.checkSweep(bodyB, bodyA)
      }
    }

    this.updateSnapshot()
  }

  /** Forwards pointer interactions to the scheduler so bodies can wake themselves. */
  notifyPointer(point: THREE.Vector2) {
    this.scheduler.notifyPointer(point)
  }

  /** Removes every body and resets the internal snapshot. */
  clear() {
    for (const id of this.bodies.keys()) {
      this.scheduler.removeBody(id)
    }
    this.bodies.clear()
    this.previousCenters.clear()
    this.snapshot = { bodies: [] }
  }

  /** Returns a deep-cloned snapshot describing the latest body positions and sleeping flags. */
  getSnapshot(): SimWorldSnapshot {
    return {
      bodies: this.snapshot.bodies.map((entry) => ({
        id: entry.id,
        center: { x: entry.center.x, y: entry.center.y },
        radius: entry.radius,
        sleeping: entry.sleeping,
      })),
    }
  }

  private updateSnapshot() {
    const bodies: SimBodySnapshot[] = []
    for (const body of this.bodies.values()) {
      const sphere = body.getBoundingSphere()
      bodies.push({
        id: body.id,
        center: { x: sphere.center.x, y: sphere.center.y },
        radius: sphere.radius,
        sleeping: body.isSleeping(),
      })
    }
    this.snapshot = { bodies }
  }

  private checkSweep(moving: SimBody, target: SimBody) {
    if (!target.isSleeping()) return

    const prev = this.previousCenters.get(moving.id)
    if (!prev) return

    const currentSphere = moving.getBoundingSphere()
    const targetSphere = target.getBoundingSphere()

    const intersects = this.segmentIntersectsSphere(
      prev,
      currentSphere.center,
      targetSphere.center,
      currentSphere.radius + targetSphere.radius
    )

    if (intersects) {
      target.wake()
    }
  }

  private segmentIntersectsSphere(
    start: { x: number; y: number },
    end: THREE.Vector2,
    center: THREE.Vector2,
    radius: number
  ) {
    const startVec = new THREE.Vector2(start.x, start.y)
    const ab = end.clone().sub(startVec)
    const ac = center.clone().sub(startVec)

    const abLengthSq = ab.lengthSq()
    if (abLengthSq === 0) {
      return ac.lengthSq() <= radius * radius
    }

    const t = THREE.MathUtils.clamp(ac.dot(ab) / abLengthSq, 0, 1)
    const closest = startVec.clone().add(ab.multiplyScalar(t))
    return closest.distanceToSquared(center) <= radius * radius
  }
}
