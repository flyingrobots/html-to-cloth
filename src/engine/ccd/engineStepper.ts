import { sweepTOI, type OBB, type AABB, type Vec2 } from './sweep'

export type Shape = OBB | AABB

export function advanceWithCCD(
  A: OBB,
  v: Vec2,
  dt: number,
  obstacles: Shape[],
  opts: { epsilon?: number } = {}
) {
  const eps = opts.epsilon ?? 1e-4
  // Try each obstacle and pick the earliest hit in [0,1]
  let best: { t: number; normal: Vec2; obstacle: Shape } | null = null
  for (const B of obstacles) {
    const res = sweepTOI(A, v, B as any, dt)
    if (!res.hit) continue
    if (best === null || res.t < best.t) best = { t: res.t, normal: res.normal, obstacle: B }
  }

  if (best) {
    const t = Math.max(0, Math.min(1, best.t))
    // Advance up to contact and place slightly before the surface along -normal
    const cx = A.center.x + v.x * dt * t - best.normal.x * eps
    const cy = A.center.y + v.y * dt * t - best.normal.y * eps
    return { center: { x: cx, y: cy }, collided: true as const }
  }

  // No hit; naive advance
  return { center: { x: A.center.x + v.x * dt, y: A.center.y + v.y * dt }, collided: false as const }
}

