import { FixedStepLoop } from './fixedStepLoop'
import { EngineWorld } from './world'

const DEFAULT_FIXED_DELTA = 1 / 60

export type SimulationRunnerOptions = {
  engine?: EngineWorld
  loop?: FixedStepLoop
  fixedDelta?: number
  maxSubSteps?: number
}

export class SimulationRunner {
  private readonly engine: EngineWorld
  private readonly loop: FixedStepLoop
  private readonly fixedDelta: number
  private substeps = 1
  private realTime = true

  constructor(options: SimulationRunnerOptions = {}) {
    this.fixedDelta = options.fixedDelta ?? DEFAULT_FIXED_DELTA
    this.engine = options.engine ?? new EngineWorld()
    this.loop =
      options.loop ??
      new FixedStepLoop({
        fixedDelta: this.fixedDelta,
        maxSubSteps: options.maxSubSteps ?? 5,
        step: (dt) => this.executeStep(dt),
      })
  }

  update(delta: number) {
    if (!this.realTime) return
    this.loop.update(delta)
  }

  stepOnce() {
    this.executeStep(this.fixedDelta)
  }

  setRealTime(enabled: boolean) {
    this.realTime = enabled
    if (enabled) {
      this.loop.reset()
      this.loop.setPaused(false)
    } else {
      this.loop.setPaused(true)
    }
  }

  setSubsteps(substeps: number) {
    this.substeps = Math.max(1, Math.round(substeps))
  }

  getEngine() {
    return this.engine
  }

  private executeStep(dt: number) {
    const iterations = Math.max(1, this.substeps)
    const stepSize = dt / iterations
    for (let i = 0; i < iterations; i++) {
      this.engine.step(stepSize)
    }
  }
}
