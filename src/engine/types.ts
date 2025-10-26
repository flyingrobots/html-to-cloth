export type EngineSystemId = string

export type EngineSystemOptions = {
  id?: EngineSystemId
  priority?: number
  allowWhilePaused?: boolean
}

export interface EngineLogger {
  error(...args: unknown[]): void
  warn?(...args: unknown[]): void
  info?(...args: unknown[]): void
}

export interface EngineWorldLike {
  setPaused(value: boolean): void
  isPaused(): boolean
  getLogger?(): EngineLogger
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
