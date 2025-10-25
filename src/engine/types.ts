/**
 * Unique identifier assigned to an engine system.
 */
export type EngineSystemId = string

/**
 * Configuration object shared by all engine systems.
 */
export type EngineSystemOptions = {
  /**
   * Optional identifier for the system; defaults to implementation-specific values.
   */
  id?: EngineSystemId
  /**
   * Higher priority systems run earlier during fixed/frame update loops.
   */
  priority?: number
  /**
   * Systems that can tick while the simulation is paused should set this to true.
   */
  allowWhilePaused?: boolean
}

/**
 * Minimal contract implemented by simulation and render systems that participate in the engine loop.
 */
export interface EngineSystem {
  id?: EngineSystemId
  priority?: number
  allowWhilePaused?: boolean
  onAttach?(world: EngineWorld): void
  onDetach?(): void
  fixedUpdate?(dt: number): void
  frameUpdate?(dt: number): void
}

/**
 * Registry responsible for coordinating system lifecycles and dispatching update ticks.
 */
export interface EngineWorld {
  /**
   * Human-readable identifier for diagnostics.
   */
  readonly id: string
  /**
   * Registers a system so it participates in subsequent update phases.
   */
  registerSystem(system: EngineSystem): void
  /**
   * Unregisters a system by its identifier.
   */
  unregisterSystem(id: EngineSystemId): void
  /**
   * Fetches a previously registered system by id.
   */
  getSystemById<T extends EngineSystem = EngineSystem>(id: EngineSystemId): T | undefined
}
