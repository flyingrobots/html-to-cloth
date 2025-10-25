export type EngineSystemId = string

export type EngineSystemOptions = {
  id?: EngineSystemId
  priority?: number
  allowWhilePaused?: boolean
}

export interface EngineWorldLike {
  setPaused(value: boolean): void
  isPaused(): boolean
}

export interface EngineSystem<TWorld extends EngineWorldLike = EngineWorldLike> {
  id?: EngineSystemId
  priority?: number
  allowWhilePaused?: boolean
  onAttach?(world: TWorld): void
  onDetach?(): void
  fixedUpdate?(dt: number): void
  frameUpdate?(dt: number): void
}
