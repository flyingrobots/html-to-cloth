## Fix CI Policy - Allowlist Infra Files

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In .github/workflows/pr-policy.yml around lines 26 to 36, the tests-first check currently rejects PRs that only touch CI/workflow, docs, or similar infra files; update the workflow to skip the test requirement for an allowlist of file paths/patterns (at minimum exclude any under .github/, files matching *.yml|*.yaml, Dockerfile, and common lockfiles) by filtering the paginated files before testing for test files; additionally implement an explicit escape hatch by detecting a PR label (e.g., skip-test-check) and, when present, bypass the test check while requiring the PR body to include an audit trail line (e.g., “skip-test-check: reason”) which the workflow validates exists; finally, add a short CONTRIBUTING.md section documenting the exempt file types and the label-based escape-hatch procedure and required audit text.

NOTES:
- This is the original, combined fix for the policy catch-22.
- The bot provided a subsequent prompt to **expand this allowlist** (see item 9 below).

---

## Fix CI Policy - Outdated/Trailing Blank Line

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In .github/workflows/pr-policy.yml around line 42 (the end of the file), remove the trailing blank line so the file ends immediately after the last YAML content line; ensure there is no extra newline or blank row after that final line to satisfy yamllint rules.

NOTES:
- Trivial nitpick for `yamllint`.

---

## Fix Docs Formatting - Missing Blank Lines Around Headings

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In docs/issues/physics-registry.md around lines 1 to 7 (and specifically headings at lines 6, 9, and 16), the file is failing markdownlint because there are missing blank lines around headings; fix by adding a single blank line before each heading and a single blank line after each heading (ensure at least one empty line separates headings from surrounding text) so the headings at the mentioned lines comply with markdownlint spacing rules.

NOTES:
- Trivial nitpick for `markdownlint`.

---

## Fix Docs Formatting - Inline Code Spacing

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In docs/issues/physics-registry.md around lines 9 to 14, remove the stray space after the opening backtick on line 10 so inline code markers have no spaces (e.g. change "` .cloth-enabled`" to "`.cloth-enabled`"); update any other inline code occurrences on these lines to the same no-space format to satisfy markdownlint.

NOTES:
- Trivial nitpick for `markdownlint`.

---

## Refactor: Improve Collision Validation & Add Tag/Payload Checks

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/events/types.ts around lines 44 to 50, the collision case uses a long unreadable boolean and misses validation of the tag fields on a and b (should allow string | null | undefined) and doesn't validate the registry:update payload structure; refactor by splitting the big boolean into named checks (e.g., validateAId = a && typeof a.id === 'string'; validateATag = a && (typeof a.tag === 'string' || a.tag === null || a.tag === undefined); same for b), keep checks for isVec2(ev.normal), isVec2(ev.mtv) and typeof ev.impulse === 'number', and return the AND of these named checks; additionally add a new branch for 'registry:update' that validates ev.payload is an object with keys previous and current (each present as unknown) before returning true.

```typescript
// Suggested change structure for src/engine/events/types.ts:
// (The bot provided a full diff structure, summarized here for clarity)
case 'collision': {
  const a = (ev.a as UnknownRecord | undefined)
  const b = (ev.b as UnknownRecord | undefined)
  if (!a || typeof a.id !== 'string') return false
  if (!b || typeof b.id !== 'string') return false
  if (a.tag !== undefined && a.tag !== null && typeof a.tag !== 'string') return false
  if (b.tag !== undefined && b.tag !== null && typeof b.tag !== 'string') return false
  if (!isVec2(ev.normal)) return false
  if (!isVec2(ev.mtv)) return false
  if (typeof ev.impulse !== 'number') return false
  return true
}
case 'registry:update':
  if (typeof ev.id !== 'string') return false
  const payload = ev.payload as UnknownRecord | undefined
  if (!payload || typeof payload !== 'object') return false
  if (!('previous' in payload) || !('current' in payload)) return false
  return true
````

---

## Feature: Implement `setActive` in `PhysicsRegistry`

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/registry/PhysicsRegistry.ts around line 90, the describe() output hardcodes active: false but there is no lifecycle or API to flip it true; add a public setActive(id: string, active: boolean) method that finds the registry entry by id, updates its active flag, persists the change in whatever in-memory/store structure is used, and emits the existing 'registry:update' event so listeners see the change; also change describe() to return the current entry.active value instead of the hardcoded false, and add input validation (existence check) and unit-test or doc comment showing the activation flow.

NOTES:
- This requires adding a new method and updating `describe()` to reflect the current active state.

---

## Fix: Limit `ci.yml` Workflow Triggers

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In .github/workflows/ci.yml around line 5: the workflow uses branches: ["\*\*"] which triggers CI on all branches (push and pull\_request) causing unnecessary CI usage; replace the wildcard with an explicit, limited set of branches (for example ["main", "develop"] or add release/\* and hotfix/\* patterns as needed) for both push and pull\_request triggers, or if you intend to keep the current wide scope, add an inline comment documenting the rationale and ensure branch protection rules gate merges to main; update the workflow triggers accordingly.

NOTES:
- Focus on reducing unnecessary CI consumption.

---

## Fix CI Policy - Normalize Escape Hatch Label Case

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In .github/workflows/pr-policy.yml around lines 32 to 38, the label check is case-sensitive (labels.includes('skip-test-check')) while the body check is case-insensitive, so labels like "Skip-Test-Check" won't match; normalize labels to a consistent case before checking (e.g., map each label name to .toLowerCase() after safely extracting string names) and then use includes('skip-test-check') against the normalized array so the label check matches the case-insensitive body regex.

```typescript
// Suggested change structure for .github/workflows/pr-policy.yml:
const skip = labels.some(l => l.toLowerCase() === 'skip-test-check')
```

---

## Fix CI Policy - Expand Infra Allowlist Regex

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In .github/workflows/pr-policy.yml around lines 39 to 49, the infra-only allowlist is too narrow and misses common config/lock/meta files; update the file-matching logic to include explicit filenames and wildcard patterns for typical infra/config files (e.g., .gitignore, .gitattributes, .dockerignore, .editorconfig, .prettierrc\*, .eslintrc\*, tsconfig.json, \*.config.js/ts), and additional lock/legal files (yarn.lock, pnpm-lock.yaml, composer.lock, Gemfile.lock, LICENSE, CODEOWNERS) so these changes are treated as infra/docs-only; modify the conditional to test for these exact filenames and patterns alongside the existing rules.

NOTES:
- This is an **expansion** of the allowlist defined in item 1. It adds critical configuration files.

---

## Fix CI Policy - Broaden Test File Detection

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> .github/workflows/pr-policy.yml lines 50-54: the current file-match regex only detects **tests** and .test.[tj]sx? files so PRs that only add .spec.[tj]sx? tests will be considered missing tests; update the predicate to also accept .spec files by broadening the regex (for example use a single pattern like /**tests**|\\.(?:test|spec)\\.[tj]sx?$/ or equivalent) so hasTest correctly returns true for both .test and .spec test filenames.

```typescript
// Suggested change structure for .github/workflows/pr-policy.yml:
const hasTest = files.some(f => /__tests__|\.(?:test|spec)\.[tj]sx?$/.test(f.filename))
```

---

## Fix UI - Prevent Toast/PerfOverlay Overlap

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/App.tsx around lines 594 to 600, the toast Affix is positioned at top:16 and uses mx="auto", which can collide with PerfOverlay (top:16, right:16); update the Affix position to { top: 16, left: 16 } (or top: 80 if you prefer below the overlay) and remove the mx="auto" prop so it does not try to center while having an explicit left value; ensure the Paper/padding remain unchanged and test with showPerf=true to confirm no overlap.

```typescript
// Suggested change structure for src/App.tsx:
<Affix position={{ top: 16, left: 16 }}>
  <Paper withBorder shadow="sm" radius="xl" w="max-content" px="md" py={8}>
    <Text size="sm">{toast}</Text>
  </Paper>
</Affix>
```

---

## Fix UI - Clear Events Panel on Open and Optimize Cap

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/app/EventsPanel.tsx around lines 11 to 21, the effect both retains events across panel closes and uses next.shift() to drop the oldest item (O(n)) when at capacity; clear the stale events on open and replace the costly shift with a constant-time approach: when open becomes true call setEvents([]) before registering the listener (so reopen shows a fresh buffer), and inside the listener use next.splice(0,1) to drop the oldest or swap to a small ring-buffer utility to maintain a fixed 100-item circular buffer instead of using shift.

NOTES:
- Requires adding `setEvents([])` before registering the listener.

---

## Fix UI - Optimize Events Panel Filter (Avoid JSON.stringify)

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/app/EventsPanel.tsx around lines 23 to 27, the current filter uses JSON.stringify on every event which is inefficient and allocates large strings per keystroke; change the filter to only inspect relevant string fields (e.g. e.type, e.id if present, e.tag if a string, and any other searchable text fields like e.message) by concatenating those fields, lowercasing once, and checking .includes(query.toLowerCase()) so nested objects aren’t serialized and the operation is much faster and lower-allocation.

NOTES:
- Requires custom string concatenation of searchable fields (e.g., type, id, tag) for filtering instead of JSON serialization.

---

## Test: Add Comprehensive Positive/Negative Validation Tests

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/events/**tests**/events.test.ts around lines 21 to 27, the current negative test only checks one trivial malformed case; add comprehensive tests that exercise all branches of validateEngineEvent: (1) negative tests for collision events missing required fields (a, b, normal, mtv, impulse), state events missing id, registry:update missing payload structure and missing payload.previous/current, and type violations such as time as string, id as number, and vector fields as strings; (2) positive tests validating every event type (state events: wake/sleep/activate/deactivate with id/time, and registry events: registry:add/registry:update/registry:remove with proper payload shapes). Implement these as Jest it() cases grouped under two describes (“rejects malformed payloads” and “validates all event types”) mirroring the examples in the review comment so the 109-line switch is fully covered.

NOTES:
- Focus on achieving full coverage for the 109-line `validateEngineEvent` switch statement.

---

## Test: Add `collision` Optional Field/Tag/Malformed Vector Tests

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/events/**tests**/events.test.ts around lines 6 to 19, the collision event test only checks a fully-populated event and misses several important validation variants; add focused test cases that (1) validate collisions with optional fields omitted (missing restitution/friction), (2) exercise tag variants for event/a/b with undefined/null/string, (3) cover edge cases like impulse 0, negative impulse, and zero-magnitude mtv, and (4) reject malformed vectors (extra properties like z on normal or mtv) so validateEngineEvent returns false; implement these as separate it(...) blocks following the existing test to ensure both positive and negative cases are covered.

---

## Test: Add `EventBus` Unsubscribe and Async Listener Tests

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/events/**tests**/events.test.ts around lines 29 to 42, the existing test covers that a throwing listener doesn't break propagation but lacks coverage for unsubscribe behavior, multiple subscribers, and async listeners; add three tests: (1) "unsubscribe prevents further events" — subscribe a listener, capture one emitted event, call the returned unsubscribe function, emit another event and assert the second event is not received; (2) "multiple subscribers all receive events" — register 3+ listeners that push to separate arrays or a shared array and assert each listener received the emitted event in the expected order/count; (3) "handles async listeners without blocking" — register an async listener that awaits a short timeout and a sync listener that pushes immediately; emit an event, assert the sync listener ran immediately (before awaiting), then await a short delay and assert the async listener ran afterward; ensure tests use the EventBus API (bus.on returns off) and make assertions on array lengths and order rather than timing-sensitive exact timestamps.

---

## Cleanup: Remove Redundant `&& process` from Environment Check

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/events/eventBus.ts around lines 11 to 25, the environment detection correctly checks both process.env.NODE\_ENV and import.meta.env.MODE but includes a redundant "&& process" after the typeof process guard; remove the unnecessary "&& process" from the if condition while preserving the existing behavior and fallbacks (keep the typeof process \!== 'undefined' and typeof process.env === 'object' checks, retain the import.meta branch and the isProd assignment logic) so the code remains portable and functionally unchanged.

```typescript
// Suggested change structure for src/engine/events/eventBus.ts:
if (typeof process !== 'undefined' && typeof process.env === 'object') {
  isProd = process.env.NODE_ENV === 'production'
}
```

---

## Fix: Validate `dataset.physShape` before Casting

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/registry/PhysicsRegistry.ts around line 97, the code blindly casts el.dataset.physShape to 'circle' | 'obb' | undefined which accepts invalid strings; instead validate the runtime value against the allowed set before assigning: read the raw string, check if it strictly equals 'circle' or 'obb' (or use a Set/array membership test), and only then assign that value (otherwise set undefined or a safe default); implement this as a small type-guard/if branch so only valid shapes are propagated.

```typescript
// Suggested change structure for src/engine/registry/PhysicsRegistry.ts:
shape: (el.dataset.physShape === 'circle' || el.dataset.physShape === 'obb') ? el.dataset.physShape : undefined,
```

---

## Test: Improve `rigidSystem` Test Assertions and Add Accessor

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/**tests**/rigidSystem.test.ts around lines 18-40, the test only asserts seen.length\>0 which is insufficient; add a RigidSystem accessor (e.g., getBody(id): DynamicBody | undefined) so tests can inspect body state, then in this test retrieve sys.getBody('box-1') after the fixedUpdate loop and assert the body exists, that body.center.y is approximately \>= 0.1 (use a small epsilon like 0.01), and that it fell significantly (e.g., center.y \< 0.5); additionally assert physics collision event properties by casting seen[0] to CollisionEvent and checking collision.normal.y is \~ -1 (toBeCloseTo with precision 1), collision.impulse \> 0, and optionally that body.velocity.y has reduced/made positive per restitution; update the loop comment to justify 120 frames as 2s at 60Hz or reduce/parametrize frames if needed.

NOTES:
- Requires adding `getBody(id)` method to `RigidSystem`.

---

## Cleanup: Consolidate `rigidSystem.ts` Imports

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/rigidSystem.ts around lines 2 to 3, the file currently has two separate import statements from '../../lib/collision/satObbAabb'; consolidate them into a single import that includes all needed exports (e.g., obbVsAabb, OBB type, and applyRestitutionFriction) in one import clause to clean up and reduce redundancy.

```typescript
// Suggested change structure for src/engine/systems/rigidSystem.ts:
import { obbVsAabb, applyRestitutionFriction, type OBB } from '../../lib/collision/satObbAabb'
```

---

## Cleanup: Remove Duplicated `Vec2`/`AABB` Types

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/rigidSystem.ts around lines 6 to 7, the file redefines Vec2 and AABB locally which duplicates types from satObbAabb and risks divergence; remove the local type declarations and import Vec2 and AABB (and OBB if needed) from ../../lib/collision/satObbAabb instead (e.g., add an import that brings in obbVsAabb plus the needed type exports) and update any references to use the imported types.

NOTES:
- Requires updating the consolidated import (item 20) to also bring in `Vec2` and `AABB`.

---

## Fix: Validate `gravity` in `rigidSystem` Constructor

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/rigidSystem.ts around lines 30-33, validate constructor inputs: ensure opts.getAabbs is a function and throw a clear error if missing or not callable; when reading opts.gravity, only accept it if typeof number && isFinite(value) && value \>= 0, otherwise use a safe default (e.g. 9.81) or throw with a clear message; additionally wrap calls to getAabbs (or validate its return) by ensuring it returns an array and each item looks like an AABB (object with numeric finite min/max properties) and throw/log a descriptive error if the check fails to prevent corrupting the simulation.

```typescript
// Suggested change structure for src/engine/systems/rigidSystem.ts:
if (typeof opts.gravity === 'number') {
  if (!Number.isFinite(opts.gravity)) {
    throw new TypeError('gravity must be a finite number')
  }
  this.gravity = opts.gravity
}
```

---

## Fix: Validate `gravity` in `setGravity`

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/rigidSystem.ts around line 35, setGravity currently assigns any number directly; validate the input by checking Number.isFinite(g) (this rules out NaN and Infinity) and that g is a number; if the check fails throw a TypeError (or reject the input) with a clear message, otherwise assign this.gravity = g; optionally clamp to a reasonable range if you want to prevent extreme values.

```typescript
// Suggested change structure for src/engine/systems/rigidSystem.ts:
setGravity(g: number) {
  if (!Number.isFinite(g)) {
    throw new TypeError('gravity must be a finite number')
  }
  this.gravity = g
}
```

---

## Fix: Add Duplicate ID Check to `addBody`

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/rigidSystem.ts around lines 37 to 39, add duplicate-ID validation to addBody(b: DynamicBody) so it rejects bodies whose id already exists in this.bodies (consistent with SimulationSystem/SimWorld): check for an existing body with the same b.id and throw a clear Error (or return the same rejection pattern used elsewhere) instead of pushing; update/add unit test(s) to assert that registering a body with an existing id is rejected and that removeBody/other state remains consistent after the failed add.

```typescript
// Suggested change structure for src/engine/systems/rigidSystem.ts:
addBody(b: DynamicBody) {
  const existing = this.bodies.find((body) => body.id === b.id)
  if (existing) {
    throw new Error(`Body with id "${b.id}" already exists`)
  }
  this.bodies.push(b)
}
```

---

## Fix: Add NaN/Infinity Guard after Integration

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/engine/systems/rigidSystem.ts around lines 46 to 54, after integrating velocity and position, add a sanity check that verifies all velocity and position components (b.velocity.x, b.velocity.y, b.center.x, b.center.y) are finite (use Number.isFinite); if any are NaN/Infinity, reset those fields to safe defaults (e.g., velocity -\> {x:0,y:0} and clamp position to previous valid or a safe value), optionally emit a warning or error log for diagnostics, and continue to the next body to prevent the simulation from silently corrupting state.

```typescript
// Suggested change structure for src/engine/systems/rigidSystem.ts:
// Guard against NaN/Infinity corruption
if (!Number.isFinite(b.center.x) || !Number.isFinite(b.center.y) || 
    !Number.isFinite(b.velocity.x) || !Number.isFinite(b.velocity.y)) {
  console.error(`Body "${b.id}" corrupted: ...`)
  // Reset or remove the body to prevent cascading corruption
  b.center.x = 0
  b.center.y = 0
  b.velocity.x = 0
  b.velocity.y = 0
}
```

---

## Test: Expand `satObbAabb` Separation Tests

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/lib/**tests**/satObbAabb.test.ts around lines 14 to 19, the existing separation test only checks X-axis separation; add two additional test cases to cover Y-axis separation and a near-miss corner (diagonal) scenario. Add one test that places the AABB entirely above the OBB (e.g., box with y-range well above the OBB) and assert collided is false, and add another test with a rotated OBB (e.g., 45°) and an AABB positioned near a corner but not touching and assert collided is false; follow the same makeOBB/makeAABB/obbVsAabb pattern as existing tests and keep assertions using expect(res.collided).toBe(false).

---

## Test: Fix `satObbAabb` Normal Assertions

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/lib/**tests**/satObbAabb.test.ts around lines 21 to 33, the normal assertions use L1 norm and miss sign consistency with the MTV; replace the L1 magnitude check with an L2 check (use Math.hypot or sqrt(x*x + y*y)) to assert the normal is unit-length, keep the dominance assertion for x, and add sign consistency checks so that Math.sign(res.normal.x) === Math.sign(res.mtv.x) (and similarly for y or ensure normal.y ≈ 0 when mtv.x dominates) to ensure the normal points the same direction as the MTV.

---

## Fix: Ensure `simulationSystem` is Instrumented

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/lib/clothSceneController.ts around lines 750-774 (note the simulation system is added earlier around line 396), the performance instrumentation wrapper for world.addSystem is installed after the constructor already registered this.simulationSystem, so the simulation system is not instrumented; to fix, ensure the wrapper is in place before any systems are added by moving the addSystem wrapper installation earlier (before the constructor registers this.simulationSystem) or, if that ordering change is infeasible, explicitly re-register or wrap the simulation system inside installRenderPipeline after the wrapper is installed (e.g., remove and re-add the simulation system or wrap its fixedUpdate/frameUpdate methods with perfMonitor calls) so the simulation system’s fixed/frame updates are captured by perfMonitor.

---

## Fix: Remove Active Cloth from `simulationSystem` on Teardown

- [x] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In src/lib/clothSceneController.ts around lines 950 to 963, the removeClothForElement routine fails to unregister active cloth bodies from the simulationSystem when item.isActive is true; update the function to check if item.isActive and if so call this.simulationSystem.removeBody(item.clothAdapter || item.entity) (or the actual body reference stored on item), then clear item.isActive and any adapter references before destroying the entity and removing the item to avoid a dangling simulation body.

---

## Docs: Fix Markdown Spacing for Headings

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In docs/issues/physics-registry.md around lines 1 to 7 (and specifically headings at lines 6, 9, and 16), the file is failing markdownlint because there are missing blank lines around headings; fix by adding a single blank line before each heading and a single blank line after each heading (ensure at least one empty line separates headings from surrounding text) so the headings at the mentioned lines comply with markdownlint spacing rules.

---

## Docs: Fix Inline Code Spacing

- [ ] Resolved
- [ ] Was Already Fixed
- [ ] Ignored

> [!note]- Rationale/Evidence
> {replace with rationale}

> In docs/issues/physics-registry.md around lines 9 to 14, remove the stray space after the opening backtick on line 10 so inline code markers have no spaces (e.g. change "`  .cloth-enabled `" to "`.cloth-enabled`"); update any other inline code occurrences on these lines to the same no-space format to satisfy markdownlint.
