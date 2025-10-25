import { FixedStepLoop } from './fixedStepLoop'
import { EngineWorld } from './world'

const DEFAULT_FIXED_DELTA = 1 / 60
const MAX_SUBSTEPS = 16

/**
 * Configuration options for {@link SimulationRunner}.
 */
export type SimulationRunnerOptions = {
  /** Preconfigured engine instance. A fresh {@link EngineWorld} is created when omitted. */
  engine?: EngineWorld
  /** Allows injecting a custom fixed-step loop implementation (primarily for tests). */
  loop?: FixedStepLoop
  /** Step size used when calling {@link stepOnce}. Defaults to 1 / 60 seconds. */
  fixedDelta?: number
  /** Maximum number of sub steps consumed per update when the accumulator grows large. */
  maxSubSteps?: number
}

/**
 * Drives a fixed-step simulation loop for an {@link EngineWorld}. The runner encapsulates
 * accumulator management, pausing, and manual stepping while remaining agnostic about the
 * systems registered with the engine.
 */
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

  /**
   * Consumes elapsed real time and advances the simulation in fixed increments when
   * {@link setRealTime real-time mode} is enabled.
   */
  update(delta: number) {
    if (!this.realTime) return
    this.loop.update(delta)
  }

  /** Performs exactly one fixed update regardless of real-time mode. */
  stepOnce() {
    this.executeStep(this.fixedDelta)
  }

  /**
   * Enables or disables real-time ticking. When disabled the accumulator is preserved so
   * that calling {@link setRealTime} with `true` immediately continues from the buffered time.
   */
  setRealTime(enabled: boolean) {
    this.realTime = enabled
    this.engine.setPaused(!enabled)
    this.loop.setPaused(!enabled)
  }

  /** Sets the number of sub steps to execute inside each fixed tick. */
  setSubsteps(substeps: number) {
    if (!Number.isFinite(substeps)) return
    const rounded = Math.round(substeps)
    const clamped = Math.max(1, Math.min(MAX_SUBSTEPS, rounded))
    this.substeps = clamped
  }

  /** Returns the underlying engine to allow external system registration. */
  getEngine() {
    return this.engine
  }

  private executeStep(dt: number) {
    const iterations = Math.max(1, this.substeps)
    const stepSize = dt / iterations
    const wasPaused = this.engine.isPaused()
    if (wasPaused) {
      this.engine.setPaused(false)
    }
    for (let i = 0; i < iterations; i++) {
      this.engine.step(stepSize)
    }
    if (wasPaused) {
      this.engine.setPaused(true)
    }
  }
}
