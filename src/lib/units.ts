export const CANONICAL_WIDTH_PX = 1024
export const CANONICAL_HEIGHT_PX = 768

/** Number of screen pixels that represent one world-space “meter”. */
export const PX_PER_METER = 256

/** Canonical world width in meters for a 1024px-wide viewport. */
export const CANONICAL_WIDTH_METERS = CANONICAL_WIDTH_PX / PX_PER_METER
/** Canonical world height in meters for a 768px-tall viewport. */
export const CANONICAL_HEIGHT_METERS = CANONICAL_HEIGHT_PX / PX_PER_METER

export type ViewportScale = {
  scaleX: number
  scaleY: number
}

export function computeViewportScale(widthPx: number, heightPx: number): ViewportScale {
  return {
    scaleX: widthPx / CANONICAL_WIDTH_PX,
    scaleY: heightPx / CANONICAL_HEIGHT_PX,
  }
}

export function toCanonicalWidthMeters(widthPx: number, viewportWidthPx: number) {
  if (viewportWidthPx === 0) return 0
  // World-space width is driven directly by the global pixel-per-meter scale.
  return widthPx / PX_PER_METER
}

export function toCanonicalHeightMeters(heightPx: number, viewportHeightPx: number) {
  if (viewportHeightPx === 0) return 0
  return heightPx / PX_PER_METER
}

export function toCanonicalX(centerPx: number, viewportWidthPx: number) {
  if (viewportWidthPx === 0) return 0
  // Map screen pixels into world space using a symmetric slice centred at the viewport midpoint.
  const halfWidthPx = viewportWidthPx / 2
  return (centerPx - halfWidthPx) / PX_PER_METER
}

export function toCanonicalY(centerPx: number, viewportHeightPx: number) {
  if (viewportHeightPx === 0) return 0
  const halfHeightPx = viewportHeightPx / 2
  // Screen Y grows downward; world Y grows upward.
  return (halfHeightPx - centerPx) / PX_PER_METER
}

export function edgeToCanonicalX(edgePx: number, viewportWidthPx: number) {
  if (viewportWidthPx === 0) return 0
  const halfWidthPx = viewportWidthPx / 2
  return (edgePx - halfWidthPx) / PX_PER_METER
}

export function edgeToCanonicalY(edgePx: number, viewportHeightPx: number) {
  if (viewportHeightPx === 0) return 0
  const halfHeightPx = viewportHeightPx / 2
  return (halfHeightPx - edgePx) / PX_PER_METER
}

export function fromPointerToCanonical(clientX: number, clientY: number, viewportWidthPx: number, viewportHeightPx: number) {
  return {
    x: toCanonicalX(clientX, viewportWidthPx),
    y: toCanonicalY(clientY, viewportHeightPx),
  }
}
