import { describe, it, expect, vi } from 'vitest'

import * as physicsScenarios from '../../engine/scenarios/physicsScenarios'
import { loadSandboxScene } from '../sandboxScenes'

describe('Sandbox scene loader', () => {
  it('delegates cloth-c1-settling to the Scenario DSL with a valid context', () => {
    const spy = vi.spyOn(physicsScenarios, 'createClothScenario')

    loadSandboxScene('cloth-c1-settling', { controller: null, actions: null })

    expect(spy).toHaveBeenCalledTimes(1)
    const [id, ctx] = spy.mock.calls[0]
    expect(id).toBe('cloth-c1-settling')
    expect(typeof ctx).toBe('object')
    expect(typeof (ctx as any).makeClothPatch).toBe('function')
  })
})

