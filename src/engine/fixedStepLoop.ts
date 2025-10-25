type FixedStepLoopOptions = {
  fixedDelta: number
  maxSubSteps?: number
  step: (dt: number) => void
}

export class FixedStepLoop {
  private readonly fixedDelta: number
  private readonly maxSubSteps: number
  private readonly step: (dt: number) => void
  private accumulator = 0
  private paused = false

  constructor(options: FixedStepLoopOptions) {
    this.fixedDelta = options.fixedDelta
    this.maxSubSteps = options.maxSubSteps ?? 5
    this.step = options.step
  }

  update(elapsed: number) {
    if (this.paused) return
    if (elapsed > 0) {
      this.accumulator += elapsed
    }
    this.consumeAccumulator()
  }

  setPaused(value: boolean) {
    if (this.paused === value) return
    this.paused = value
    if (value) {
      this.reset()
    }
  }

  reset() {
    this.accumulator = 0
  }

  private consumeAccumulator() {
    let steps = 0
    while (this.accumulator >= this.fixedDelta && steps < this.maxSubSteps) {
      this.step(this.fixedDelta)
      this.accumulator -= this.fixedDelta
      steps += 1
    }
  }
}
