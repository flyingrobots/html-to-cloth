import { describe, it, expect } from 'vitest'

import {
  toCanonicalWidthMeters,
  toCanonicalHeightMeters,
  toCanonicalX,
  toCanonicalY,
} from '../units'

describe('World scale – px to meters mapping', () => {
  const VIEWPORT_WIDTH_PX = 1024
  const VIEWPORT_HEIGHT_PX = 768

  it('treats a 1024px wide viewport as a 4m wide world slice', () => {
    const widthMeters = toCanonicalWidthMeters(VIEWPORT_WIDTH_PX, VIEWPORT_WIDTH_PX)
    expect(widthMeters).toBeCloseTo(4, 3)
  })

  it('treats a 768px tall viewport as a 3m tall world slice', () => {
    const heightMeters = toCanonicalHeightMeters(VIEWPORT_HEIGHT_PX, VIEWPORT_HEIGHT_PX)
    expect(heightMeters).toBeCloseTo(3, 3)
  })

  it('maps screen center to world origin for the canonical viewport', () => {
    const centerX = VIEWPORT_WIDTH_PX / 2
    const centerY = VIEWPORT_HEIGHT_PX / 2
    const x = toCanonicalX(centerX, VIEWPORT_WIDTH_PX)
    const y = toCanonicalY(centerY, VIEWPORT_HEIGHT_PX)
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(0, 6)
  })

  it('maps viewport edges to ±2m horizontally and ±1.5m vertically for the canonical size', () => {
    // Left / right edges
    expect(toCanonicalX(0, VIEWPORT_WIDTH_PX)).toBeCloseTo(-2, 3)
    expect(toCanonicalX(VIEWPORT_WIDTH_PX, VIEWPORT_WIDTH_PX)).toBeCloseTo(2, 3)

    // Top / bottom edges
    expect(toCanonicalY(0, VIEWPORT_HEIGHT_PX)).toBeCloseTo(1.5, 3)
    expect(toCanonicalY(VIEWPORT_HEIGHT_PX, VIEWPORT_HEIGHT_PX)).toBeCloseTo(-1.5, 3)
  })
})

