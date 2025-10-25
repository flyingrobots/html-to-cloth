export type EngineSystemId = string

export type EngineSystemOptions = {
  id?: EngineSystemId
  priority?: number
  allowWhilePaused?: boolean
}

export interface EngineSystem {
  id?: EngineSystemId
  priority?: number
  allowWhilePaused?: boolean
  onAttach?(world: unknown): void
  onDetach?(): void
  fixedUpdate?(dt: number): void
  frameUpdate?(dt: number): void
}
