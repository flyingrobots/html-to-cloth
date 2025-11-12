export type Vec2 = { x: number; y: number }

export type OBB = {
  kind: 'obb'
  center: Vec2
  half: Vec2
  angle: number // radians
}

export type SweepResult =
  | { hit: false }
  | { hit: true; t: number; normal: Vec2; point?: Vec2 }

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function intervalsOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMax >= bMin && bMax >= aMin
}

/**
 * Swept slabs for axis-aligned OBB↔OBB (i.e., boxes with angle≈0).
 * Returns normalized t in [0,1] over the given dt window and a unit normal opposing motion.
 */
function sweepObbObbAxisAligned(A: OBB, vRel: Vec2, B: OBB, dt: number): SweepResult {
  const dx = vRel.x * dt
  const dy = vRel.y * dt

  const aMinX = A.center.x - A.half.x
  const aMaxX = A.center.x + A.half.x
  const aMinY = A.center.y - A.half.y
  const aMaxY = A.center.y + A.half.y

  const bMinX = B.center.x - B.half.x
  const bMaxX = B.center.x + B.half.x
  const bMinY = B.center.y - B.half.y
  const bMaxY = B.center.y + B.half.y

  // Already overlapping at t=0 → TOI=0
  if (intervalsOverlap(aMinX, aMaxX, bMinX, bMaxX) && intervalsOverlap(aMinY, aMaxY, bMinY, bMaxY)) {
    // Choose a reasonable separating normal (opposing velocity, fallback +X)
    const n = Math.hypot(vRel.x, vRel.y) > 0 ? { x: vRel.x, y: vRel.y } : { x: 1, y: 0 }
    const len = Math.hypot(n.x, n.y)
    return { hit: true, t: 0, normal: { x: -n.x / len, y: -n.y / len } }
  }

  // Compute per-axis entry/exit using swept AABB logic with displacement (dx,dy)
  let txEntry: number, txExit: number
  if (dx > 0) {
    txEntry = (bMinX - aMaxX) / dx
    txExit = (bMaxX - aMinX) / dx
  } else if (dx < 0) {
    txEntry = (bMaxX - aMinX) / dx
    txExit = (bMinX - aMaxX) / dx
  } else {
    if (!intervalsOverlap(aMinX, aMaxX, bMinX, bMaxX)) return { hit: false }
    txEntry = -Infinity
    txExit = Infinity
  }

  let tyEntry: number, tyExit: number
  if (dy > 0) {
    tyEntry = (bMinY - aMaxY) / dy
    tyExit = (bMaxY - aMinY) / dy
  } else if (dy < 0) {
    tyEntry = (bMaxY - aMinY) / dy
    tyExit = (bMinY - aMaxY) / dy
  } else {
    if (!intervalsOverlap(aMinY, aMaxY, bMinY, bMaxY)) return { hit: false }
    tyEntry = -Infinity
    tyExit = Infinity
  }

  const tEnter = Math.max(txEntry, tyEntry)
  const tExit = Math.min(txExit, tyExit)

  // Reject when no overlap over [0,1]
  if (!(tEnter <= tExit)) return { hit: false }
  if (tExit < 0 || tEnter > 1) return { hit: false }

  // Clamp to [0,1]
  const t = clamp(tEnter, 0, 1)

  // Impact normal from axis of entry
  let normal: Vec2
  if (txEntry > tyEntry) {
    // Hit along X
    normal = dx > 0 ? { x: -1, y: 0 } : { x: 1, y: 0 }
  } else {
    // Hit along Y
    normal = dy > 0 ? { x: 0, y: -1 } : { x: 0, y: 1 }
  }

  // Approximate contact point on B's face at TOI
  const cx = A.center.x + dx * t
  const cy = A.center.y + dy * t
  let point: Vec2 | undefined
  if (Math.abs(normal.x) > Math.abs(normal.y)) {
    const x = normal.x < 0 ? bMinX : bMaxX
    point = { x, y: clamp(cy, bMinY, bMaxY) }
  } else {
    const y = normal.y < 0 ? bMinY : bMaxY
    point = { x: clamp(cx, bMinX, bMaxX), y }
  }

  return { hit: true, t, normal, point }
}

/**
 * Top-level CCD sweep entry.
 * Currently supports OBB↔OBB when both are axis-aligned (angle≈0) using swept slabs.
 * The API is stable, so future work can add GJK‑TOI/EPA and rotated OBBs.
 */
export function sweepTOI(A: OBB, vRel: Vec2, B: OBB, dt: number): SweepResult {
  // For now, treat small angles as axis-aligned (tolerance ~1e-4 rad)
  const eps = 1e-4
  const aAligned = Math.abs(A.angle) < eps || Math.abs(Math.abs(A.angle) - Math.PI) < eps
  const bAligned = Math.abs(B.angle) < eps || Math.abs(Math.abs(B.angle) - Math.PI) < eps

  if (A.kind === 'obb' && B.kind === 'obb' && aAligned && bAligned) {
    return sweepObbObbAxisAligned(A, vRel, B, dt)
  }

  // Not yet supported
  return { hit: false }
}

