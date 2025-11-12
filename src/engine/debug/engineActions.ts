import * as THREE from 'three'

import type { SimulationRunner } from '../simulationRunner'
import type { EngineWorld } from '../world'
import type { CameraSystem, CameraSnapshot } from '../camera/CameraSystem'
import type { SimulationSystem } from '../systems/simulationSystem'
import { DebugOverlayState } from '../render/DebugOverlayState'
import { RenderSettingsState } from '../render/RenderSettingsState'
import type { PinMode } from '../../types/pinMode'

export type EngineActionsOptions = {
  runner: SimulationRunner
  world: EngineWorld
  camera?: CameraSystem | null
  simulation?: SimulationSystem | null
  overlay?: DebugOverlayState | null
  renderSettings?: RenderSettingsState | null
  setTessellation?: (segments: number) => void | Promise<void>
  setPinMode?: (mode: PinMode) => void
  setCcdEnabled?: (enabled: boolean) => void
  setCcdProbeSpeed?: (speed: number) => void
  configureCcd?: (opts: { speedThreshold?: number; epsilon?: number }) => void
  setCcdCollisionListener?: (listener: ((payload: { id: string; obstacle: any; t: number; normal: { x: number; y: number } }) => void) | null) => void
}

/**
 * Small facade that routes debug UI interactions into the engine layer.
 *
 * Intentionally narrow: we start with engine-safe actions that do not require
 * per-body mutation (those will be added as dedicated SimulationSystem APIs later).
 */
export class EngineActions {
  private readonly runner: SimulationRunner
  private readonly world: EngineWorld
  private readonly camera: CameraSystem | null
  private readonly simulation: SimulationSystem | null
  private readonly overlay: DebugOverlayState | null
  private readonly renderSettings: RenderSettingsState | null
  private readonly setTessellationCb?: (segments: number) => void | Promise<void>
  private readonly setPinModeCb?: (mode: PinMode) => void
  private readonly setCcdEnabledCb?: (enabled: boolean) => void
  private readonly setCcdProbeSpeedCb?: (speed: number) => void
  private readonly configureCcdCb?: (opts: { speedThreshold?: number; epsilon?: number }) => void
  private readonly setCcdCollisionListenerCb?: (listener: ((payload: { id: string; obstacle: any; t: number; normal: { x: number; y: number } }) => void) | null) => void

  constructor(options: EngineActionsOptions) {
    this.runner = options.runner
    this.world = options.world
    this.camera = options.camera ?? null
    this.simulation = options.simulation ?? null
    this.overlay = options.overlay ?? null
    this.renderSettings = options.renderSettings ?? null
    this.setTessellationCb = options.setTessellation
    this.setPinModeCb = options.setPinMode
    this.setCcdEnabledCb = options.setCcdEnabled
    this.setCcdProbeSpeedCb = options.setCcdProbeSpeed
    this.configureCcdCb = options.configureCcd
    this.setCcdCollisionListenerCb = options.setCcdCollisionListener
  }

  /** Enables/disables real-time ticking. */
  setRealTime(enabled: boolean) {
    this.runner.setRealTime(enabled)
  }

  /** Performs exactly one fixed step on the runner. */
  stepOnce() {
    this.runner.stepOnce()
  }

  /** Adjusts the number of substeps per fixed tick. */
  setSubsteps(substeps: number) {
    this.runner.setSubsteps(substeps)
  }

  /**
   * Camera controls (no-ops when no camera system is provided).
   */
  setCameraTarget(position: THREE.Vector3) {
    this.camera?.setTarget(position)
  }

  setCameraTargetZoom(zoom: number) {
    this.camera?.setTargetZoom(zoom)
  }

  jumpCamera(position: THREE.Vector3, zoom?: number) {
    this.camera?.jumpTo(position, zoom)
  }

  configureCamera(options: Parameters<CameraSystem['configure']>[0]) {
    this.camera?.configure(options)
  }

  /** Broadcasts gravity to all simulation bodies (if supported). */
  setGravityScalar(gravity: number) {
    if (!this.simulation) return
    // Use a fresh vector to avoid accidental shared-reference mutation downstream.
    this.simulation.broadcastGravity(new THREE.Vector3(0, -gravity, 0))
  }

  /** Broadcasts constraint iterations to all bodies (if supported). */
  setConstraintIterations(iterations: number) {
    this.simulation?.broadcastConstraintIterations(iterations)
  }

  /** Updates sleep thresholds for all bodies and future activations (UI should also update controller defaults). */
  setSleepConfig(velocityThreshold: number, frameThreshold: number) {
    if (!this.simulation) return
    this.simulation.broadcastSleepConfiguration({ velocityThreshold, frameThreshold })
  }

  /** Queues warm-start passes for all bodies using current or provided iterations. */
  warmStartNow(passes: number, constraintIterations: number) {
    if (!this.simulation) return
    const p = Math.max(0, Math.round(passes))
    const it = Math.max(1, Math.round(constraintIterations))
    this.simulation.broadcastWarmStart({ passes: p, constraintIterations: it })
  }

  /** Toggles pointer overlay visibility (render-only gizmos). */
  setPointerOverlayVisible(visible: boolean) {
    if (this.overlay) this.overlay.visible = visible
  }

  /** Toggles cloth wireframe rendering (applied by RenderSettingsSystem). */
  setWireframe(enabled: boolean) {
    if (this.renderSettings) this.renderSettings.wireframe = enabled
  }

  /** Requests tessellation change (rebuild inactive meshes via controller-provided callback). */
  async setTessellation(segments: number) {
    if (this.setTessellationCb) await this.setTessellationCb(segments)
  }

  /** Sets cloth pin mode via controller-provided callback. */
  setPinMode(mode: PinMode) {
    this.setPinModeCb?.(mode)
  }

  // CCD controls (optional; noop if not wired)
  setCcdEnabled(enabled: boolean) {
    this.setCcdEnabledCb?.(enabled)
  }
  setCcdProbeSpeed(speed: number) {
    this.setCcdProbeSpeedCb?.(speed)
  }
  configureCcd(opts: { speedThreshold?: number; epsilon?: number }) {
    this.configureCcdCb?.(opts)
  }

  onCcdCollision(listener: ((payload: { id: string; obstacle: any; t: number; normal: { x: number; y: number } }) => void) | null) {
    this.setCcdCollisionListenerCb?.(listener)
  }

  /** Exposes the attached world for advanced hooks (read-only usage suggested). */
  getWorld() {
    return this.world
  }

  /**
   * Returns an immutable deep copy of the latest camera snapshot when a
   * camera system is attached. See CameraSystem.getSnapshot() for details.
   */
  getCameraSnapshot(): CameraSnapshot | undefined {
    return this.camera?.getSnapshot()
  }
}
