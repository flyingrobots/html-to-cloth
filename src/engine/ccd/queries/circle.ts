import type { Vec2 } from '../sweep'

export type CircleTOIResult = { hit: false } | { hit: true; t: number; normal?: Vec2 }

export function circleCircleTOI(
  a: { c: Vec2; r: number },
  va: Vec2,
  b: { c: Vec2; r: number },
  vb: Vec2,
  dt: number
): CircleTOIResult {
  const p = { x: a.c.x - b.c.x, y: a.c.y - b.c.y }
  const v = { x: (va.x - vb.x) * dt, y: (va.y - vb.y) * dt }
  const R = a.r + b.r
  const aQ = v.x * v.x + v.y * v.y
  const bQ = 2 * (p.x * v.x + p.y * v.y)
  const cQ = p.x * p.x + p.y * p.y - R * R
  if (aQ < 1e-12) {
    if (cQ <= 0) return { hit: true, t: 0, normal: norm(p) }
    return { hit: false }
  }
  const disc = bQ * bQ - 4 * aQ * cQ
  if (disc < 0) return { hit: false }
  const sqrtD = Math.sqrt(disc)
  const t1 = (-bQ - sqrtD) / (2 * aQ)
  const t2 = (-bQ + sqrtD) / (2 * aQ)
  let t = Number.POSITIVE_INFINITY
  if (t1 >= 0 && t1 <= 1) t = Math.min(t, t1)
  if (t2 >= 0 && t2 <= 1) t = Math.min(t, t2)
  if (!Number.isFinite(t)) return { hit: false }
  const hitVec = { x: p.x + v.x * t, y: p.y + v.y * t }
  return { hit: true, t, normal: norm(hitVec) }
}

function norm(v: Vec2): Vec2 {
  const L = Math.hypot(v.x, v.y)
  if (L < 1e-12) return { x: 1, y: 0 }
  return { x: v.x / L, y: v.y / L }
}

