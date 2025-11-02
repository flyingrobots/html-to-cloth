import { describe, it, expect } from 'vitest'

// Spec for PR A: non-modal Events panel, toggled by Cmd/Ctrl+E, opens at ~45% height and supports fullscreen
// This is a placeholder failing test to drive implementation.

describe('Events panel (spec)', () => {
  it('toggles with Cmd/Ctrl+E and is non-modal (scene remains interactive)', async () => {
    const nonModalEventsPanel = false
    expect(nonModalEventsPanel).toBe(true)
  })
})

