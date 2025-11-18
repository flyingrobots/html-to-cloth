# Physics Scenarios DSL Spec

Location: `src/engine/scenarios/physicsScenarios.ts`

This document specifies the **Physics Scenarios DSL**: a small, type-safe layer for
describing canonical physics scenarios (acceptance scenes) that can be exercised by:

- unit tests / integration tests (headless),
- the `/sandbox` route (interactive “test maps”),
- and future E2E/Playwright flows.

The DSL is intentionally minimal. It centralises **initial conditions and invariants**
for key physics behaviours so that all callers (tests, sandbox, tools) share the same
definition of “Cloth C1”, “Stack Rest”, etc.

The **tests remain the ultimate source of truth** (“the tests ARE the spec”). This
document explains the structure and intent behind those tests.

---

## 1. Goals and non-goals

### 1.1 Goals

- Provide a **single place** to define physics acceptance scenes:
  - Cloth settling and wake/sleep behaviour.
  - Rigid rest/jitter scenarios.
  - CCD scenarios (future).
- Make those scenes reusable across:
  - `vitest` suites (headless acceptance tests).
  - Sandbox UI scene loaders.
  - Future automation (Playwright, CLI).
- Enable **normative expectations** to be attached to each scenario so tests can
  assert behaviour (not just configuration).

### 1.2 Non-goals (v0.1)

- No generic “scene graph” or full game-engine scripting language.
- No persistence or external config files.
- No runtime discovery via reflection; scenarios are explicit, typed exports.

---

## 2. Module overview

Module: `src/engine/scenarios/physicsScenarios.ts`

Exports:

- Scenario identifiers
  - `type ClothScenarioId = 'cloth-c1-settling' | 'cloth-c2-sleep-wake'`
  - `type RigidScenarioId = 'rigid-stack-rest'`
  - `clothScenarioIds: ClothScenarioId[]`
  - `rigidScenarioIds: RigidScenarioId[]`
- Scenario factories
  - `createClothScenario(id: ClothScenarioId, ctx: ClothScenarioContext): ClothScenarioResult`
  - `createRigidScenario(id: RigidScenarioId): RigidScenarioResult`

Related tests:

- `src/engine/scenarios/__tests__/physicsScenarios.test.ts`
  - Exercises the DSL directly and encodes the **normative behaviour** for each scenario.
- `src/engine/__tests__/physicsAcceptanceScenes.test.ts`
  - Reuses the DSL for cloth acceptance tests (C1/C2) to avoid divergence.
- `src/engine/systems/__tests__/rigidStaticSystem.rest.test.ts`
  - Validates rigid stack rest behaviour independently of the DSL.

---

## 3. Cloth scenarios

### 3.1 Types

```ts
export type ClothScenarioContext = {
  three: typeof THREE_NS
  makeClothPatch: (widthVertices?: number, heightVertices?: number) => ClothPhysics
}

export type ClothScenarioResult = {
  cloth: ClothPhysics
  /** Step function used by both tests and Sandbox to advance the scenario. */
  step: (dt: number) => void
}
```

**Constraints:**

- `makeClothPatch` must return a `ClothPhysics` instance that behaves like the one
  used in `physicsAcceptanceScenes.test.ts` and `clothPhysics.test.ts`.
- `step(dt)` must be equivalent to calling `cloth.update(dt)` for the scenario’s
  internal cloth instance.

### 3.2 IDs

```ts
export type ClothScenarioId = 'cloth-c1-settling' | 'cloth-c2-sleep-wake'

export const clothScenarioIds: ClothScenarioId[] = [
  'cloth-c1-settling',
  'cloth-c2-sleep-wake',
]
```

IDs are **stable**: callers may rely on them for routing (e.g. sandbox menus) and
tests may assert they exist in `clothScenarioIds`.

### 3.3 Factory behavior

#### `cloth-c1-settling`

Factory (simplified):

```ts
const cloth = ctx.makeClothPatch(5, 5)
cloth.setGravity(new ctx.three.Vector3(0, 0, 0))
cloth.addTurbulence(0.01)

const step = (dt: number) => { cloth.update(dt) }
return { cloth, step }
```

Normative expectations (from tests):

- After 240 steps at `dt = 0.016`:
  - `cloth.isSleeping()` **must** be `true`.
  - Over the last 60 steps, the vertical center jitter window **must** satisfy:
    - `maxY - minY < 1e-4`

These expectations are encoded in:

- `src/engine/scenarios/__tests__/physicsScenarios.test.ts`
- `src/engine/__tests__/physicsAcceptanceScenes.test.ts`

#### `cloth-c2-sleep-wake`

Factory (simplified):

```ts
const cloth = ctx.makeClothPatch(3, 3)
cloth.setGravity(new ctx.three.Vector3(0, 0, 0))

const step = (dt: number) => { cloth.update(dt) }
return { cloth, step }
```

Normative expectations:

- After 160 steps at `dt = 0.016`:
  - `cloth.isSleeping()` **must** be `true`.
- Let `sphere = cloth.getBoundingSphere()` and `insidePoint` be the center:
  - Calling `cloth.wakeIfPointInside(insidePoint)` **must** transition the cloth
    out of sleep (`cloth.isSleeping()` becomes `false`).
- Applying a point force at `insidePoint` and stepping once:
  - `cloth.applyPointForce(insidePoint, new Vector2(0.5, 0), 1, 1)`
  - then `step(0.016)` **must** change at least one vertex’ x-coordinate so that
    `after.x` is **not** `toBeCloseTo(before.x)`.

Encodings:

- `physicsScenarios.test.ts` (DSL-level).
- `physicsAcceptanceScenes.test.ts` (acceptance-level).

---

## 4. Rigid scenarios

### 4.1 Types

```ts
export type RigidScenarioId =
  | 'rigid-stack-rest'
  | 'rigid-drop-onto-static'

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
```

### 4.2 IDs

```ts
export const rigidScenarioIds: RigidScenarioId[] = [
  'rigid-stack-rest',
  'rigid-drop-onto-static',
]
```

### 4.3 Factory behaviour: `rigid-stack-rest`

Factory (simplified):

```ts
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

const bottom: RigidBody = { /* id:1, at y=0.25, friction/restitution, etc. */ }
const top: RigidBody = { /* id:2, at y=0.55, friction/restitution, etc. */ }

system.addBody(bottom)
system.addBody(top)

return { system, topBody: top }
```

Normative expectations:

- Stepping the system for 360 steps at `dt = 1/60`:
  - Take the last 60 samples of `topBody.center.y`:
    - `maxY - minY < 0.08`
- Implicitly, the stack must **not** explode or drift unboundedly.

Encodings:

- `src/engine/scenarios/__tests__/physicsScenarios.test.ts`
- `src/engine/systems/__tests__/rigidStaticSystem.rest.test.ts`

### 4.4 Factory behaviour: `rigid-drop-onto-static`

Factory (simplified):

```ts
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
```

Normative expectations:

- Stepping the system for 240 steps at `dt = 1/60`:
  - Let `yHistory` be the Y position of the body’s center over time.
  - Basic motion:
    - `yHistory[last] < yHistory[0]` (the box must have moved downward).
  - Rest behaviour:
    - Over the last 60 samples:
      - `maxY - minY < 0.25` (some residual jitter allowed, but the body should be effectively at rest on the floor).

Encodings:

- `src/engine/scenarios/__tests__/physicsScenarios.test.ts`

---

## 5. Normative metadata and observability (future extension)

The DSL currently defines **configuration + minimal expectations** through tests.
We intend to extend it with **normative metadata** to capture observability
contracts for each scenario.

Planned shape (conceptual):

```ts
type ScenarioCategory = 'cloth' | 'rigid' | 'ccd'

type ScenarioExpectation = {
  id: string
  category: ScenarioCategory
  label: string
  description: string
  // How the scenario is typically exercised in automated tests.
  defaultSteps?: { dt: number; count: number }
  // Behavioural invariants that should hold when the scenario is executed.
  invariants?: {
    sleep?: { mustSleepByStep?: number }
    jitter?: { windowSize: number; maxDelta: number }
    events?: {
      // e.g. ["Sleep", "Wake", "CollisionV2", "CcdHit"]
      requiredTypes?: string[]
    }
  }
}
```

Usage:

- Unit/integration tests:
  - Use `invariants` to assert that simulated runs meet expectations.
- Sandbox:
  - Use `category` and `events.requiredTypes` to:
    - Auto-enable relevant overlays (e.g. wake markers, CCD hit markers).
    - Configure the EventsPanel view.

Implementation of this metadata is **not yet present**, but this document fixes
the intent so future work can be judged against it.

---

## 6. Extension guidelines

When adding new scenarios (e.g. CCD thin-wall, angled stacks, cloth/rigid combos):

1. **Add a typed ID**
   - Extend `ClothScenarioId` / `RigidScenarioId` (or future `CcdScenarioId`).
   - Append to the corresponding `*_ScenarioIds` array.

2. **Define the factory**
   - Implement `createClothScenario` / `createRigidScenario` branch with:
     - Initial conditions.
     - Any scenario-specific hooks (e.g. pre-shaken state).

3. **Write DSL-level tests first**
   - Add a new test to `physicsScenarios.test.ts` that:
     - Exercises the scenario via the DSL.
     - Encodes the normative behaviour (sleep, jitter, tunnelling, etc.).

4. **Optionally refactor higher-level tests**
   - Where appropriate, update existing acceptance tests to use the DSL factory
     rather than inlining setup, to keep the spec centralised.

5. **Update Sandbox wiring (once it exists)**
   - Wire the new ID into the `/sandbox` “Tests” menu.
   - Use the scenario factory to configure the live engine world.

By following these steps, we keep:

- Scenario definitions **typed and explicit**.
- Behavioural expectations **enforced by tests**.
- Sandbox / Playwright flows **grounded in the same spec** as unit tests.
