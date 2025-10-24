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
  gravity: THREE.Vector3
}

export type SimSleepConfig = {
  velocityThreshold: number
  frameThreshold: number
}

export type SimBodySnapshot = {
  id: string
  center: THREE.Vector2
  radius: number
  sleeping: boolean
}

export type SimWorldSnapshot = {
  bodies: SimBodySnapshot[]
}

export class SimWorld {
  private scheduler: SimulationScheduler
  private bodies = new Map<string, SimBody>()
  private previousCenters = new Map<string, THREE.Vector2>()
  private snapshot: SimWorldSnapshot = { bodies: [] }

  constructor(scheduler?: SimulationScheduler) {
    this.scheduler = scheduler ?? new SimulationScheduler()
  }

  addBody(body: SimBody) {
    if (this.bodies.has(body.id)) {
      throw new Error(`Cannot add duplicate body id: ${body.id}`)
    }
    this.bodies.set(body.id, body)
    this.scheduler.addBody(body)
    this.previousCenters.set(body.id, body.getBoundingSphere().center.clone())
    this.updateSnapshot()
  }

  removeBody(id: string) {
    this.bodies.delete(id)
    this.scheduler.removeBody(id)
    this.previousCenters.delete(id)
    this.updateSnapshot()
  }

  step(dt: number) {
    for (const [id, body] of this.bodies.entries()) {
      this.previousCenters.set(id, body.getBoundingSphere().center.clone())
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

  notifyPointer(point: THREE.Vector2) {
    this.scheduler.notifyPointer(point)
  }

  clear() {
    for (const id of this.bodies.keys()) {
      this.scheduler.removeBody(id)
    }
    this.bodies.clear()
    this.previousCenters.clear()
    this.snapshot = { bodies: [] }
  }

  getSnapshot(): SimWorldSnapshot {
    return {
      bodies: this.snapshot.bodies.map((entry) => ({
        id: entry.id,
        center: entry.center.clone(),
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
        center: sphere.center.clone(),
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
    start: THREE.Vector2,
    end: THREE.Vector2,
    center: THREE.Vector2,
    radius: number
  ) {
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
