import type * as THREE_NS from 'three'
import { EventBus } from '../events/bus'
import { RigidStaticSystem, type RigidBody } from '../systems/rigidStaticSystem'
import type { AABB } from '../systems/rigidStaticSystem'
import type { ClothPhysics } from '../../lib/clothPhysics'

// ---- Public types ----

export type ClothScenarioId = 'cloth-c1-settling' | 'cloth-c2-sleep-wake'
export type RigidScenarioId = 'rigid-stack-rest' | 'rigid-drop-onto-static'

export const clothScenarioIds: ClothScenarioId[] = [
  'cloth-c1-settling',
  'cloth-c2-sleep-wake',
]

export const rigidScenarioIds: RigidScenarioId[] = [
  'rigid-stack-rest',
  'rigid-drop-onto-static',
]

export type ClothScenarioContext = {
  three: typeof THREE_NS
  makeClothPatch: (widthVertices?: number, heightVertices?: number) => ClothPhysics
}

export type ClothScenarioResult = {
  cloth: ClothPhysics
  /** Step function used by both tests and Sandbox to advance the scenario. */
  step: (dt: number) => void
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

    default: {
      const _exhaustive: never = id
      throw new Error(`Unknown rigid scenario id: ${_exhaustive}`)
    }
  }
}
