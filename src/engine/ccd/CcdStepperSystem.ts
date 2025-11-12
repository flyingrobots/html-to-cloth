import type { EngineSystem } from '../types'
import { CcdSettingsState } from './CcdSettingsState'
import { advanceWithCCD } from './engineStepper'
import type { OBB, AABB, Vec2 } from './sweep'

export type MovingBody = {
  id: string
  shape: OBB
  velocity: Vec2
  setCenter: (x: number, y: number) => void
}

export type CcdStepperOptions = {
  state: CcdSettingsState
  /** supplies dynamic bodies to advance each fixedUpdate */
  getMovingBodies: () => MovingBody[]
  /** supplies obstacles to test against */
  getObstacles: () => Array<OBB | AABB>
}

/**
 * Minimal feature-flagged CCD stepper that advances supplied bodies using sweepTOI.
 * Intended as a bridge until a full PhysicsSystem consumes CCD natively.
 */
export class CcdStepperSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = false

  private readonly state: CcdSettingsState
  private readonly getMovingBodies: () => MovingBody[]
  private readonly getObstacles: () => Array<OBB | AABB>

  constructor(options: CcdStepperOptions) {
    this.state = options.state
    this.getMovingBodies = options.getMovingBodies
    this.getObstacles = options.getObstacles
    this.priority = 55 // after typical physics integrators
    this.id = 'ccd-stepper'
  }

  fixedUpdate(dt: number) {
    if (!this.state.enabled) return
    const bodies = this.getMovingBodies()
    if (!bodies.length) return
    const obstacles = this.getObstacles()
    for (const b of bodies) {
      const speed = Math.hypot(b.velocity.x, b.velocity.y)
      if (speed < this.state.speedThreshold) {
        // Naive advance, below CCD threshold
        b.setCenter(b.shape.center.x + b.velocity.x * dt, b.shape.center.y + b.velocity.y * dt)
        continue
      }
      const out = advanceWithCCD(b.shape, b.velocity, dt, obstacles, { epsilon: this.state.epsilon })
      b.setCenter(out.center.x, out.center.y)
    }
  }
}

