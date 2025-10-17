export const CANONICAL_WIDTH_PX = 1024
export const CANONICAL_HEIGHT_PX = 768

export const CSS_PIXELS_PER_METER = 3779.527559055

export const CANONICAL_WIDTH_METERS = CANONICAL_WIDTH_PX / CSS_PIXELS_PER_METER
export const CANONICAL_HEIGHT_METERS = CANONICAL_HEIGHT_PX / CSS_PIXELS_PER_METER

/**
 * @typedef {{scaleX: number, scaleY: number}} ViewportScale
 */

/**
 * @param {number} widthPx
 * @param {number} heightPx
 * @returns {ViewportScale}
 */
export function computeViewportScale(widthPx, heightPx) {
  return {
    scaleX: widthPx / CANONICAL_WIDTH_PX,
    scaleY: heightPx / CANONICAL_HEIGHT_PX,
  }
}

/**
 * @param {number} widthPx
 * @param {number} viewportWidthPx
 */
export function toCanonicalWidthMeters(widthPx, viewportWidthPx) {
  const ratio = viewportWidthPx === 0 ? 0 : widthPx / viewportWidthPx
  return ratio * CANONICAL_WIDTH_METERS
}

/**
 * @param {number} heightPx
 * @param {number} viewportHeightPx
 */
export function toCanonicalHeightMeters(heightPx, viewportHeightPx) {
  const ratio = viewportHeightPx === 0 ? 0 : heightPx / viewportHeightPx
  return ratio * CANONICAL_HEIGHT_METERS
}

/**
 * @param {number} centerPx
 * @param {number} viewportWidthPx
 */
export function toCanonicalX(centerPx, viewportWidthPx) {
  if (viewportWidthPx === 0) return 0
  const u = centerPx / viewportWidthPx
  return (u - 0.5) * CANONICAL_WIDTH_METERS
}

/**
 * @param {number} centerPx
 * @param {number} viewportHeightPx
 */
export function toCanonicalY(centerPx, viewportHeightPx) {
  if (viewportHeightPx === 0) return 0
  const v = centerPx / viewportHeightPx
  return (0.5 - v) * CANONICAL_HEIGHT_METERS
}

/**
 * @param {number} edgePx
 * @param {number} viewportWidthPx
 */
export function edgeToCanonicalX(edgePx, viewportWidthPx) {
  if (viewportWidthPx === 0) return 0
  const u = edgePx / viewportWidthPx
  return u * CANONICAL_WIDTH_METERS - CANONICAL_WIDTH_METERS / 2
}

/**
 * @param {number} edgePx
 * @param {number} viewportHeightPx
 */
export function edgeToCanonicalY(edgePx, viewportHeightPx) {
  if (viewportHeightPx === 0) return 0
  const v = edgePx / viewportHeightPx
  return CANONICAL_HEIGHT_METERS / 2 - v * CANONICAL_HEIGHT_METERS
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} viewportWidthPx
 * @param {number} viewportHeightPx
 */
export function fromPointerToCanonical(clientX, clientY, viewportWidthPx, viewportHeightPx) {
  return {
    x: toCanonicalX(clientX, viewportWidthPx),
    y: toCanonicalY(clientY, viewportHeightPx),
  }
}
