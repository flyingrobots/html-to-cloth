import * as THREE from 'three'

export type SleepableBody = {
  id: string
  update: (dt: number) => void
  isSleeping: () => boolean
  wake: () => void
  wakeIfPointInside?: (point: THREE.Vector2) => void
}

export class SimulationScheduler {
  private bodies = new Map<string, SleepableBody>()

  addBody(body: SleepableBody) {
    this.bodies.set(body.id, body)
  }

  removeBody(id: string) {
    this.bodies.delete(id)
  }

  wakeBody(id: string) {
    const body = this.bodies.get(id)
    if (!body) return
    body.wake()
  }

  notifyPointer(point: THREE.Vector2) {
    for (const body of this.bodies.values()) {
      if (!body.isSleeping()) continue
      if (body.wakeIfPointInside) {
        body.wakeIfPointInside(point)
      }
    }
  }

  step(dt: number) {
    for (const body of this.bodies.values()) {
      if (body.isSleeping()) continue
      body.update(dt)
    }
  }

  clear() {
    this.bodies.clear()
  }
}
