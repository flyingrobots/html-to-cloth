export type PickPoint = { x: number; y: number }

export type PickBody = {
  id: number
  center: { x: number; y: number }
  half: { x: number; y: number }
}

export type PickHit = {
  id: number
  point: PickPoint
}

/**
 * Minimal picking helper for an orthographic view: treats bodies as
 * axis-aligned boxes in canonical space and returns the first body
 * whose AABB contains the point.
 */
export function pickBodyAtPoint(point: PickPoint, bodies: PickBody[]): PickHit | null {
  for (const b of bodies) {
    const minX = b.center.x - b.half.x
    const maxX = b.center.x + b.half.x
    const minY = b.center.y - b.half.y
    const maxY = b.center.y + b.half.y
    if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
      return { id: b.id, point: { x: point.x, y: point.y } }
    }
  }
  return null
}

