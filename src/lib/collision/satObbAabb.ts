export type Vec2 = { x: number; y: number }
export type OBB = { center: Vec2; half: Vec2; rotation: number }
export type AABB = { min: Vec2; max: Vec2 }

export type SatResult = {
  collided: boolean
  mtv: Vec2
  normal: Vec2
  depth: number
}

export function obbVsAabb(obb: OBB, box: AABB): SatResult {
  // Axes to test: OBB local axes (u, v) and world axes (x, y) for AABB
  const c = Math.cos(obb.rotation)
  const s = Math.sin(obb.rotation)
  const axes: Vec2[] = [
    { x: c, y: s }, // OBB x-axis
    { x: -s, y: c }, // OBB y-axis
    { x: 1, y: 0 }, // world x (AABB)
    { x: 0, y: 1 }, // world y (AABB)
  ]

  const aabbCenter: Vec2 = {
    x: (box.min.x + box.max.x) * 0.5,
    y: (box.min.y + box.max.y) * 0.5,
  }

  let minOverlap = Infinity
  let bestAxis: Vec2 = { x: 0, y: 0 }
  let axisSign = 1

  for (const axis of axes) {
    // Normalize axis to be safe
    const len = Math.hypot(axis.x, axis.y) || 1
    const nx = axis.x / len
    const ny = axis.y / len

    // Project OBB: center projection +/- radius along axis
    const r = obbRadiusOnAxis(obb, { x: nx, y: ny })
    const obbC = obb.center.x * nx + obb.center.y * ny
    const obbMin = obbC - r
    const obbMax = obbC + r

    // Project AABB: extremal projections are achieved at one of its corners
    const { min, max } = projectAabbOnAxis(box, { x: nx, y: ny })

    // Compute overlap (if any)
    const overlap = intervalOverlap(obbMin, obbMax, min, max)
    if (overlap <= 0) {
      return { collided: false, mtv: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, depth: 0 }
    }

    if (overlap < minOverlap) {
      minOverlap = overlap
      bestAxis = { x: nx, y: ny }
      // Direction: from OBB to AABB along axis
      const delta = (aabbCenter.x - obb.center.x) * nx + (aabbCenter.y - obb.center.y) * ny
      axisSign = delta >= 0 ? 1 : -1
    }
  }

  const normal = { x: bestAxis.x * axisSign, y: bestAxis.y * axisSign }
  const mtv = { x: normal.x * minOverlap, y: normal.y * minOverlap }
  return { collided: true, mtv, normal, depth: minOverlap }
}

function obbRadiusOnAxis(obb: OBB, axis: Vec2): number {
  // OBB local axes
  const c = Math.cos(obb.rotation)
  const s = Math.sin(obb.rotation)
  const ux = c, uy = s
  const vx = -s, vy = c
  // Project half extents onto axis
  const rx = Math.abs(axis.x * ux + axis.y * uy) * obb.half.x
  const ry = Math.abs(axis.x * vx + axis.y * vy) * obb.half.y
  return rx + ry
}

function projectAabbOnAxis(box: AABB, axis: Vec2) {
  const corners: Vec2[] = [
    { x: box.min.x, y: box.min.y },
    { x: box.min.x, y: box.max.y },
    { x: box.max.x, y: box.min.y },
    { x: box.max.x, y: box.max.y },
  ]
  let min = Infinity
  let max = -Infinity
  for (const p of corners) {
    const d = p.x * axis.x + p.y * axis.y
    if (d < min) min = d
    if (d > max) max = d
  }
  return { min, max }
}

function intervalOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  const left = Math.max(aMin, bMin)
  const right = Math.min(aMax, bMax)
  return right - left
}

export function applyRestitutionFriction(v: Vec2, normal: Vec2, restitution: number, friction: number): Vec2 {
  const len = Math.hypot(normal.x, normal.y) || 1
  const nx = normal.x / len
  const ny = normal.y / len
  const vn = v.x * nx + v.y * ny // scalar normal component
  const vx_t = v.x - vn * nx
  const vy_t = v.y - vn * ny
  const vnAfter = -Math.max(0, Math.min(1, restitution)) * vn
  const frictionScale = Math.max(0, 1 - Math.max(0, Math.min(1, friction)))
  const vtAfterX = vx_t * frictionScale
  const vtAfterY = vy_t * frictionScale
  return { x: vnAfter * nx + vtAfterX, y: vnAfter * ny + vtAfterY }
}

