import type * as THREE_NS from 'three'
import { EventBus } from '../events/bus'
import { RigidStaticSystem, type RigidBody } from '../systems/rigidStaticSystem'
import type { AABB } from '../systems/rigidStaticSystem'
import { ClothPhysics } from '../../lib/clothPhysics'

// ---- Public types ----

export type ClothScenarioId =
  | 'cloth-c1-settling'
  | 'cloth-c2-sleep-wake'
  | 'cloth-cr1-over-box'
  | 'cloth-cr2-rigid-hit'
export type RigidScenarioId = 'rigid-stack-rest' | 'rigid-drop-onto-static' | 'rigid-thin-wall-ccd'

export const clothScenarioIds: ClothScenarioId[] = [
  'cloth-c1-settling',
  'cloth-c2-sleep-wake',
  'cloth-cr1-over-box',
  'cloth-cr2-rigid-hit',
]

export const rigidScenarioIds: RigidScenarioId[] = [
  'rigid-stack-rest',
  'rigid-drop-onto-static',
  'rigid-thin-wall-ccd',
]

export type ScenarioPreset = {
  cameraZoom?: number
  overlay?: {
    drawAABBs?: boolean
    drawSleep?: boolean
    drawPins?: boolean
    drawWake?: boolean
  }
}

export const scenarioPresets: Partial<Record<ClothScenarioId | RigidScenarioId, ScenarioPreset>> = {
  'cloth-c1-settling': { cameraZoom: 1.05, overlay: { drawAABBs: true, drawSleep: true } },
  'cloth-c2-sleep-wake': { cameraZoom: 1.05, overlay: { drawAABBs: true, drawSleep: true, drawWake: true } },
  'cloth-cr1-over-box': { cameraZoom: 1.1, overlay: { drawAABBs: true, drawSleep: true } },
  'cloth-cr2-rigid-hit': { cameraZoom: 1.2, overlay: { drawAABBs: true, drawSleep: true, drawPins: true, drawWake: true } },
  'rigid-stack-rest': { cameraZoom: 1.0, overlay: { drawAABBs: true } },
  'rigid-drop-onto-static': { cameraZoom: 1.0, overlay: { drawAABBs: true } },
  'rigid-thin-wall-ccd': { cameraZoom: 1.0, overlay: { drawAABBs: true } },
}

export type ClothScenarioContext = {
  three: typeof THREE_NS
  makeClothPatch: (widthVertices?: number, heightVertices?: number) => ClothPhysics
}

export type ClothScenarioResult = {
  cloth: ClothPhysics
  /** Step function used by both tests and Sandbox to advance the scenario. */
  step: (dt: number) => void
  projectile?: { center: THREE_NS.Vector2; velocity: THREE_NS.Vector2; radius: number }
}

export type RigidScenarioResult =
  | {
      system: RigidStaticSystem
      /** Convenience handle for the top body in the stack. */
      topBody: RigidBody
    }
  | {
      system: RigidStaticSystem
      /** Single dynamic body that will drop onto a static floor. */
      body: RigidBody
    }

// ---- Cloth scenarios ----

export function createClothScenario(
  id: ClothScenarioId,
  ctx: ClothScenarioContext,
): ClothScenarioResult {
  switch (id) {
    case 'cloth-c1-settling': {
      const cloth = ctx.makeClothPatch(5, 5)

      cloth.setGravity(new ctx.three.Vector3(0, 0, 0))
      cloth.addTurbulence(0.01)

      const step = (dt: number) => {
        cloth.update(dt)
      }

      return { cloth, step }
    }

    case 'cloth-c2-sleep-wake': {
      const cloth = ctx.makeClothPatch(3, 3)

      cloth.setGravity(new ctx.three.Vector3(0, 0, 0))

      const step = (dt: number) => {
        cloth.update(dt)
      }

      return { cloth, step }
    }

    case 'cloth-cr1-over-box': {
      const geom = new ctx.three.PlaneGeometry(1, 1, 6, 6)
      geom.translate(0, 0.8, 0)
      const mat = new ctx.three.MeshBasicMaterial()
      const mesh = new ctx.three.Mesh(geom, mat)
      const cloth = new ClothPhysics(mesh)
      cloth.setGravity(new ctx.three.Vector3(0, -9.81, 0))
      cloth.setConstraintIterations(6)
      cloth.setSleepThresholds(0.005, 200)
      cloth.setSubsteps(2)

      const floorHalf = { x: 0.7, y: 0.1 }
      const floorCenter = { x: 0, y: 0 }

      const step = (dt: number) => {
        cloth.update(dt)
        cloth.collideWithObstacles([
          {
            kind: 'aabb',
            min: { x: floorCenter.x - floorHalf.x, y: floorCenter.y - floorHalf.y },
            max: { x: floorCenter.x + floorHalf.x, y: floorCenter.y + floorHalf.y },
          },
        ])
      }

      return { cloth, step }
    }

    case 'cloth-cr2-rigid-hit': {
      const geom = new ctx.three.PlaneGeometry(1, 1, 6, 6)
      geom.translate(0, 0.6, 0)
      const mat = new ctx.three.MeshBasicMaterial()
      const mesh = new ctx.three.Mesh(geom, mat)
      const cloth = new ClothPhysics(mesh)
      cloth.pinTopEdge()
      cloth.setGravity(new ctx.three.Vector3(0, -9.81, 0))
      cloth.setConstraintIterations(6)
      cloth.setSleepThresholds(0.002, 140)
      cloth.setSubsteps(2)

      const projectile = {
        center: new ctx.three.Vector2(-0.6, 0),
        velocity: new ctx.three.Vector2(3, -0.2),
        radius: 0.06,
      }

      const step = (dt: number) => {
        cloth.update(dt)
        cloth.collideWithObstacles([
          {
            kind: 'sphere',
            center: { x: projectile.center.x, y: projectile.center.y },
            radius: projectile.radius,
          },
        ])
        projectile.center.addScaledVector(projectile.velocity, dt)
      }

      return { cloth, step }
    }

    default: {
      const _exhaustive: never = id
      throw new Error(`Unknown cloth scenario id: ${_exhaustive}`)
    }
  }
}

// ---- Rigid scenarios ----

export function createRigidScenario(id: RigidScenarioId): RigidScenarioResult {
  switch (id) {
    case 'rigid-stack-rest': {
      const bus = new EventBus({ capacity: 256, mailboxCapacity: 256 })
      const groundY = 0
      const staticAabbs: AABB[] = [
        { min: { x: -1, y: groundY - 0.1 }, max: { x: 1, y: groundY } },
      ]

      const system = new RigidStaticSystem({
        bus,
        getAabbs: () => staticAabbs,
        gravity: 9.81,
        enableDynamicPairs: true,
        sleepVelocityThreshold: 0.01,
        sleepFramesThreshold: 30,
      })

      const bottom: RigidBody = {
        id: 1,
        center: { x: 0, y: 0.25 },
        half: { x: 0.1, y: 0.1 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 1,
        restitution: 0.1,
        friction: 0.8,
      }

      const top: RigidBody = {
        id: 2,
        center: { x: 0, y: 0.55 },
        half: { x: 0.1, y: 0.1 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 1,
        restitution: 0.1,
        friction: 0.8,
      }

      system.addBody(bottom)
      system.addBody(top)

      return { system, topBody: top }
    }

    case 'rigid-drop-onto-static': {
      const bus = new EventBus({ capacity: 128, mailboxCapacity: 128 })
      const groundY = 0
      const staticAabbs: AABB[] = [
        { min: { x: -1, y: groundY - 0.1 }, max: { x: 1, y: groundY } },
      ]

      const system = new RigidStaticSystem({
        bus,
        getAabbs: () => staticAabbs,
        gravity: 9.81,
        enableDynamicPairs: false,
        sleepVelocityThreshold: 0.01,
        sleepFramesThreshold: 45,
      })

      const body: RigidBody = {
        id: 1,
        center: { x: 0, y: 0.6 },
        half: { x: 0.12, y: 0.08 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 1,
        restitution: 0.2,
        friction: 0.6,
      }

      system.addBody(body)

      return { system, body }
    }

    case 'rigid-thin-wall-ccd': {
      const bus = new EventBus({ capacity: 128, mailboxCapacity: 128 })
      const wall: AABB = {
        min: { x: 0.0, y: -1 },
        max: { x: 0.02, y: 1 },
      }
      const system = new RigidStaticSystem({
        bus,
        getAabbs: () => [wall],
        gravity: 0,
        enableDynamicPairs: false,
      })
      system.configureCcd({ enabled: true, speedThreshold: 0.5, epsilon: 1e-4 })

      const fastBody: RigidBody = {
        id: 99,
        center: { x: -1, y: 0 },
        half: { x: 0.1, y: 0.1 },
        angle: 0,
        velocity: { x: 6, y: 0 },
        restitution: 0,
        friction: 0,
        mass: 1,
      }

      system.addBody(fastBody)

      return { system, body: fastBody }
    }

    default: {
      const _exhaustive: never = id
      throw new Error(`Unknown rigid scenario id: ${_exhaustive}`)
    }
  }
}
