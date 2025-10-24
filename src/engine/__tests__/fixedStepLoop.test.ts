import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FixedStepLoop } from '../fixedStepLoop'

describe('FixedStepLoop', () => {
  let step: ReturnType<typeof vi.fn>
  let loop: FixedStepLoop

  beforeEach(() => {
    step = vi.fn()
    loop = new FixedStepLoop({
      fixedDelta: 0.01,
      maxSubSteps: 5,
      step,
    })
  })

  it('consumes elapsed time in fixed-sized steps using an accumulator', () => {
    loop.update(0.025)
    expect(step).toHaveBeenCalledTimes(2)
    expect(step).toHaveBeenNthCalledWith(1, 0.01)
    expect(step).toHaveBeenNthCalledWith(2, 0.01)

    loop.update(0.005)
    expect(step).toHaveBeenCalledTimes(3)
  })

  it('caps the number of steps to avoid spiral of death', () => {
    loop.update(0.5)
    expect(step).toHaveBeenCalledTimes(5)
  })

  it('can pause and resume without losing accumulated time', () => {
    loop.update(0.015)
    expect(step).toHaveBeenCalledTimes(1)

    loop.setPaused(true)
    loop.update(0.015)
    expect(step).toHaveBeenCalledTimes(1)

    loop.setPaused(false)
    loop.update(0.0)
    expect(step).toHaveBeenCalledTimes(2)
  })

  it('resets accumulator when requested', () => {
    loop.update(0.015)
    expect(step).toHaveBeenCalledTimes(1)

    loop.reset()
    loop.update(0.005)
    expect(step).toHaveBeenCalledTimes(1)
  })
})
