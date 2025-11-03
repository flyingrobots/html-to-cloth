export type EngineEventCommon = {
  time: number // ms since epoch
  tag?: string | null
}

export type CollisionEvent = EngineEventCommon & {
  type: 'collision'
  a: { id: string; tag?: string | null }
  b: { id: string; tag?: string | null }
  normal: { x: number; y: number }
  mtv: { x: number; y: number }
  impulse: number
  restitution?: number
  friction?: number
}

export type StateEvent = EngineEventCommon & (
  | { type: 'wake'; id: string }
  | { type: 'sleep'; id: string }
  | { type: 'activate'; id: string; reason?: string }
  | { type: 'deactivate'; id: string; reason?: string }
)

export type RegistryEventRecord = EngineEventCommon & (
  | { type: 'registry:add'; id: string; payload: unknown }
  | { type: 'registry:update'; id: string; payload: { previous: unknown; current: unknown } }
  | { type: 'registry:remove'; id: string; payload: unknown }
)

export type EngineEvent = CollisionEvent | StateEvent | RegistryEventRecord

type UnknownRecord = Record<string, unknown>

export function isVec2(v: unknown): v is { x: number; y: number } {
  if (!v || typeof v !== 'object') return false
  const r = v as UnknownRecord
  return typeof r.x === 'number' && typeof r.y === 'number'
}

export function validateEngineEvent(e: unknown): e is EngineEvent {
  if (!e || typeof e !== 'object') return false
  const ev = e as UnknownRecord
  if (typeof ev.time !== 'number') return false
  switch (ev.type) {
    case 'collision': {
      const a = (ev.a as UnknownRecord | undefined)
      const b = (ev.b as UnknownRecord | undefined)
      const ok = !!(a && typeof a.id === 'string' && b && typeof b.id === 'string' && isVec2(ev.normal) && isVec2(ev.mtv) && typeof ev.impulse === 'number')
      return ok
    }
    case 'wake':
    case 'sleep':
    case 'activate':
    case 'deactivate':
      return typeof ev.id === 'string'
    case 'registry:add':
    case 'registry:update':
    case 'registry:remove':
      return typeof ev.id === 'string'
    default:
      return false
  }
}
