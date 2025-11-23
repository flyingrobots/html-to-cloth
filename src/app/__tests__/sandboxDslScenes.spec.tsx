import { describe, it, expect } from 'vitest'

import { loadSandboxScene } from '../sandboxScenes'

/**
 * Failing smoke specs for the upcoming Sandbox 2.0 DSL mapping (N2.3).
 * These scene ids are not yet implemented; tests should fail until the DSL and sandbox wiring exist.
 */
// TODO(N2.3): enable once DSL scenes are added to sandbox loaders.
describe.skip('Sandbox DSL scenes (N2.3 placeholders)', () => {
  const deps = { controller: { clearSandboxObjects: () => {} }, actions: null }

  it('loads cloth CR1 DSL scene without throwing', () => {
    expect(() => loadSandboxScene('cloth-cr1-over-box' as any, deps)).not.toThrow()
  })

  it('loads cloth CR2 DSL scene without throwing', () => {
    expect(() => loadSandboxScene('cloth-cr2-rigid-hit' as any, deps)).not.toThrow()
  })

  it('loads rigid thin-wall CCD DSL scene without throwing', () => {
    expect(() => loadSandboxScene('rigid-thin-wall-ccd' as any, deps)).not.toThrow()
  })
})
