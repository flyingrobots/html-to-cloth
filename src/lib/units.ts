export const CANONICAL_WIDTH_PX = 1024
export const CANONICAL_HEIGHT_PX = 768

export const CSS_PIXELS_PER_METER = 3779.527559055

export const CANONICAL_WIDTH_METERS = CANONICAL_WIDTH_PX / CSS_PIXELS_PER_METER
export const CANONICAL_HEIGHT_METERS = CANONICAL_HEIGHT_PX / CSS_PIXELS_PER_METER

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
  const ratio = viewportWidthPx === 0 ? 0 : widthPx / viewportWidthPx
  return ratio * CANONICAL_WIDTH_METERS
}

export function toCanonicalHeightMeters(heightPx: number, viewportHeightPx: number) {
  const ratio = viewportHeightPx === 0 ? 0 : heightPx / viewportHeightPx
  return ratio * CANONICAL_HEIGHT_METERS
}

export function toCanonicalX(centerPx: number, viewportWidthPx: number) {
  if (viewportWidthPx === 0) return 0
  const u = centerPx / viewportWidthPx
  return (u - 0.5) * CANONICAL_WIDTH_METERS
}

export function toCanonicalY(centerPx: number, viewportHeightPx: number) {
  if (viewportHeightPx === 0) return 0
  const v = centerPx / viewportHeightPx
  return (0.5 - v) * CANONICAL_HEIGHT_METERS
}

export function edgeToCanonicalX(edgePx: number, viewportWidthPx: number) {
  if (viewportWidthPx === 0) return 0
  const u = edgePx / viewportWidthPx
  return u * CANONICAL_WIDTH_METERS - CANONICAL_WIDTH_METERS / 2
}

export function edgeToCanonicalY(edgePx: number, viewportHeightPx: number) {
  if (viewportHeightPx === 0) return 0
  const v = edgePx / viewportHeightPx
  return CANONICAL_HEIGHT_METERS / 2 - v * CANONICAL_HEIGHT_METERS
}

export function fromPointerToCanonical(clientX: number, clientY: number, viewportWidthPx: number, viewportHeightPx: number) {
  return {
    x: toCanonicalX(clientX, viewportWidthPx),
    y: toCanonicalY(clientY, viewportHeightPx),
  }
}
