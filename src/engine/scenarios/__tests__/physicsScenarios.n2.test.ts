import { describe, it, expect } from 'vitest'

import { clothScenarioIds, rigidScenarioIds } from '../physicsScenarios'

/**
 * Failing specs to pin Scenario DSL expectations for N2.3 before implementation.
 */
describe('Scenario DSL coverage for N2', () => {
  it('includes cloth+rigid mixed scenes for Sandbox 2.0', () => {
    expect(clothScenarioIds as any).toContain('cloth-cr1-over-box')
    expect(clothScenarioIds as any).toContain('cloth-cr2-rigid-hit')
  })

  it('includes rigid CCD demo scene for PhysicsSystem-level R1', () => {
    expect(rigidScenarioIds as any).toContain('rigid-thin-wall-ccd')
  })
})
