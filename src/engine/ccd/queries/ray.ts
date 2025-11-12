import type { Vec2, OBB } from '../sweep'

export type RayHit = { hit: false } | { hit: true; tEnter: number; tExit: number; normal?: Vec2; point?: Vec2 }

export function rayAabbSlabs(origin: Vec2, dir: Vec2, min: Vec2, max: Vec2): RayHit {
  const invX = 1 / (dir.x === 0 ? 1e-12 : dir.x)
  const invY = 1 / (dir.y === 0 ? 1e-12 : dir.y)
  let t1 = (min.x - origin.x) * invX
  let t2 = (max.x - origin.x) * invX
  let t3 = (min.y - origin.y) * invY
  let t4 = (max.y - origin.y) * invY
  const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4))
  const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4))
  if (tmax < 0 || tmin > tmax) return { hit: false }
  const tEnter = tmin
  const tExit = tmax
  let normal: Vec2 | undefined
  // Determine axis of entry from which pair produced tEnter
  if (tEnter === Math.min(t1, t2)) {
    normal = t1 < t2 ? { x: -1, y: 0 } : { x: 1, y: 0 }
  } else {
    normal = t3 < t4 ? { x: 0, y: -1 } : { x: 0, y: 1 }
  }
  const point: Vec2 = { x: origin.x + dir.x * tEnter, y: origin.y + dir.y * tEnter }
  return { hit: true, tEnter, tExit, normal, point }
}

function axisFromAngle(theta: number) {
  const c = Math.cos(theta), s = Math.sin(theta)
  return { ux: { x: c, y: s }, uy: { x: -s, y: c } }
}

export function rayObbLocalSlabs(origin: Vec2, dir: Vec2, obb: OBB): RayHit {
  const { ux, uy } = axisFromAngle(obb.angle)
  const dx = origin.x - obb.center.x
  const dy = origin.y - obb.center.y
  const oL = { x: dx * ux.x + dy * ux.y, y: dx * uy.x + dy * uy.y }
  const dL = { x: dir.x * ux.x + dir.y * ux.y, y: dir.x * uy.x + dir.y * uy.y }
  const min = { x: -obb.half.x, y: -obb.half.y }
  const max = { x: obb.half.x, y: obb.half.y }
  // Ray vs AABB in local space
  const res = rayAabbSlabs(oL, dL, min, max)
  if (!res.hit) return res
  const pLx = oL.x + dL.x * res.tEnter
  const pLy = oL.y + dL.y * res.tEnter
  const pW = {
    x: obb.center.x + pLx * ux.x + pLy * uy.x,
    y: obb.center.y + pLx * ux.y + pLy * uy.y,
  }
  const nL = res.normal ?? { x: 0, y: 0 }
  const nW = { x: nL.x * ux.x + nL.y * uy.x, y: nL.x * ux.y + nL.y * uy.y }
  const L = Math.hypot(nW.x, nW.y) || 1
  return { hit: true, tEnter: res.tEnter, tExit: res.tExit, normal: { x: nW.x / L, y: nW.y / L }, point: pW }
}
