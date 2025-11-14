# SWEEPSTAKES — Continuous Collision Detection Roadmap (2D)

This is the end‑to‑end plan to turn our physics into swept, time‑of‑impact (TOI) collision detection across all shape pairs, with a concrete test checklist for correctness and robustness.

Legend used in the pairwise goals below:
- ✅ = supported; swept (TOI)
- 🫱 = supported; discrete only (no TOI)
- ⏳ = not supported… yet
- ❌ = not applicable / no support

Focus: convex 2D shapes. Non‑convex POLYGONs should be convex‑decomposed.

---

## Current Collision Matrix (2D)

Legend: ✅ = supported; swept (TOI) • 🫱 = supported; not swept • ⏳ = not supported… yet • ❌ = no support

Notes:
- 1: OBB moving vs static AABB uses a simple TOI sweep (binary search on t). Dynamic–dynamic pairs are still discrete for now.
- 2: OBB moving vs static OBB ramps are swept (approximate TOI). Dynamic–dynamic OBB pairs are discrete; scheduled to become swept.
- 3: Cloth↔rigid uses circle (particle) vs OBB discrete contacts.
- 4: Ray cells are query semantics, not manifold collisions. “Swept” means we return parametric t and hit normal/point when available.

|         | AABB | OBB | POLYGON | CIRCLE | RAY | LINE SEGMENT | HALF-SPACE |
|---------|:----:|:---:|:-------:|:------:|:---:|:------------:|:----------:|
| AABB    |  ⏳  | ✅¹ |   ⏳    |   ⏳   |  ⏳ |      ⏳       |     ⏳     |
| OBB     | ✅¹  | 🫱² |   ⏳    |  🫱³  | ✅⁴ |      ⏳       |     ⏳     |
| POLYGON |  ⏳  |  ⏳ |   ⏳    |   ⏳   |  ⏳ |      ⏳       |     ⏳     |
| CIRCLE  |  ⏳  | 🫱³ |   ⏳    |   ⏳   |  ⏳ |      ⏳       |     ⏳     |
| RAY     |  ⏳  | ✅⁴ |   ⏳    |   ⏳   |  ❌ |      ⏳       |     ⏳     |
| SEGMENT |  ⏳  |  ⏳ |   ⏳    |   ⏳   |  ⏳ |      ⏳       |     ⏳     |
| HALF-SP |  ⏳  |  ⏳ |   ⏳    |   ⏳   |  ⏳ |      ⏳       |     ⏳     |

We will update this table toward all‑green as CCD work lands. See the Implementation Phases below for the roadmap.

## 1) Pairwise Coverage Targets

- [ ] AABB ↔ AABB (swept slabs)
- [ ] AABB ↔ OBB (swept SAT or GJK-TOI)
- [ ] AABB ↔ POLYGON (swept SAT or GJK-TOI)
- [ ] AABB ↔ CIRCLE (expand AABB by r + swept slabs)
- [ ] AABB ↔ RAY (ray–AABB slabs)
- [ ] AABB ↔ LINE SEGMENT (segment–AABB slabs)
- [ ] AABB ↔ HALF-SPACE (analytic TOI by extreme)

- [ ] OBB ↔ OBB (swept SAT on {A.ux,A.uy,B.ux,B.uy} or GJK-TOI)
- [ ] OBB ↔ POLYGON (swept SAT or GJK-TOI)
- [ ] OBB ↔ CIRCLE (expand OBB by r + swept SAT, or GJK-TOI)
- [ ] OBB ↔ RAY (ray in OBB local frame slabs)
- [ ] OBB ↔ LINE SEGMENT (segment in OBB local frame slabs)
- [ ] OBB ↔ HALF-SPACE (analytic TOI over extreme projection)

- [ ] POLYGON ↔ POLYGON (swept SAT on both normals, or GJK-TOI preferred)
- [ ] POLYGON ↔ CIRCLE (offset polygon by r + swept SAT, or GJK-TOI)
- [ ] POLYGON ↔ RAY (ray vs convex poly via half-space clipping)
- [ ] POLYGON ↔ LINE SEGMENT (segment vs poly clipping)
- [ ] POLYGON ↔ HALF-SPACE (analytic TOI by extreme)

- [ ] CIRCLE ↔ CIRCLE (analytic quadratic TOI)
- [ ] CIRCLE ↔ RAY (analytic)
- [ ] CIRCLE ↔ LINE SEGMENT (analytic)
- [ ] CIRCLE ↔ HALF-SPACE (analytic: (r − sd)/(-n·v))

- [ ] RAY ↔ RAY (N/A for volume collision; keep as query only) ❌
- [ ] RAY ↔ LINE SEGMENT (parametric intersection test)
- [ ] RAY ↔ HALF-SPACE (analytic)

- [ ] LINE SEGMENT ↔ LINE SEGMENT (parametric)
- [ ] LINE SEGMENT ↔ HALF-SPACE (analytic)

Progress gate: a cell is considered ✅ when we have TOI (t∈[0,1]), a contact normal, and an optional contact point, with stable behavior near degeneracies.

---

## 2) Implementation Phases

### Phase A — Core CCD Kernel
- [ ] Implement convex support functions
  - [ ] AABB (as OBB rot=0) — support(dir)
  - [ ] OBB — support(dir) using oriented axes
  - [ ] POLYGON — support(dir) over vertex list (convex)
  - [ ] CIRCLE — center + dir·r
- [ ] Add GJK distance + raycast mode (GJK-TOI)
  - [ ] Conservative Advancement loop to find TOI along v_rel
  - [ ] Tolerances: max iters, penetration epsilon, parallel threshold
- [ ] Add EPA fallback for contact normal when GJK finishes at touch
- [ ] Top-level API: `sweepTOI(A,B,pose0,velA,velB,dt,opts)` → { hit, t, normal, point?, iters }

### Phase B — Fast Paths / Analytic & SAT
- [ ] AABB↔AABB swept slabs (fast exact)
- [x] Ray/Segment queries
  - [x] ray–AABB slabs, ray–OBB (local‑frame slabs) (9c4f056, d0dc200)
  - [ ] ray/segment–POLYGON via half‑space clipping
  - [ ] ray/segment–CIRCLE analytic
- [x] CIRCLE pairs
  - [x] circle–circle analytic TOI (9c4f056)
  - [ ] circle vs AABB/OBB via expansion + slabs/SAT
- [ ] Swept SAT (optional alternative to GJK-TOI)
  - [ ] Candidate axes = face normals of the two shapes
  - [ ] Interval t_enter / t_exit per axis; TOI = max(t_enter)

### Phase C — Engine Integration
- [ ] Canonicalize relative motion (A moves vs static B)
- [ ] CCD policy
  - [ ] Global toggle + speed threshold + max CCD iters
  - [ ] Use CCD for “fast or small” bodies; discrete otherwise
- [ ] RigidSystem integration
  - [ ] For each candidate pair: compute TOI; advance to t; solve impulse; advance remainder (1−t)·dt
  - [ ] Limit per‑step CCD resolves (e.g., ≤3) to avoid livelock
  - [ ] Degeneracy fallback to discrete SAT
- [ ] Angular handling (stage 1)
  - [ ] Ignore rotation within TOI; integrate ω normally after resolve
- [ ] Angular handling (stage 2, optional)
  - [ ] Conservative shape expansion by |ω|·dt margin or micro‑substep rotation

### Phase D — Broad‑Phase & Perf
- [ ] Swept AABB prefilter for moving bodies
- [ ] Simple spatial hash or small BVH for pruning
- [ ] Telemetry: CCD triggers / iters / fallback counts

### Phase E — UX & Docs
- [x] Debug toggles in UI (initial): collision gizmos, overlay flags (cf77924)
- [x] Overlay: visualize contacts, normals, center→contact lines, impulses, gravity (cf77924)
- [ ] CCD-specific toggles (CCD on/off, threshold, max iters)
- [ ] Developer docs (ccd/README): algorithms, epsilons, pitfalls

---

## 3) Robustness Policy (Epsilon & Degeneracy)
- [ ] Parallel/near‑parallel axis threshold for swept SAT
- [ ] Time domain guards: clamp t to [0,1]; reject tiny negative t with tolerance
- [ ] Overlap at t=0: return t=0, get normal from EPA (or previous frame)
- [ ] Separating motion (v_rel · n > 0): skip normal impulse
- [ ] Tie‑breakers for vertex/edge corner hits: normal priority order, stable selection
- [ ] Denormal/−0 handling in projections and dot products

---

## 4) Test Plan (Unit & Integration)

### 4.1 Analytic Ground‑Truth Tests
- [ ] Ray–AABB slabs: axis‑aligned & arbitrary origin/direction
- [ ] Ray–OBB local‑frame slabs (rotation sweep across [0,π))
- [ ] Ray–POLYGON: half‑space clipping (various convex shapes)
- [ ] Ray–CIRCLE: quadratic roots (enter/exit), grazing case
- [ ] Segment variants: same as above with t∈[0,1]
- [ ] Circle–Circle: analytic TOI across random seeds and edge cases
- [ ] Shape–Half‑Space: analytic TOI from extreme projections

### 4.2 Swept SAT / GJK‑TOI Consistency
- [ ] AABB–AABB swept slabs vs GJK‑TOI: match t within epsilon
- [ ] OBB–OBB: GJK‑TOI vs high‑substep discrete reference (N≥128)
- [ ] POLYGON–POLYGON (convex): GJK‑TOI vs discrete reference
- [ ] Circle–OBB via expansion vs GJK‑TOI

### 4.3 Corner & Grazing Edge Cases
- [ ] Ray hits OBB exactly at a vertex at 45° (both inclusive/exclusive policies)
- [ ] Ray skims an OBB edge (tangent): should classify as no‑enter (or t=0 touch) per policy, with stable normal
- [ ] Circle grazing a sloped OBB (tangent contact): single TOI, no normal flip‑flop
- [ ] Nearly parallel motion: max(t_enter) ≈ min(t_exit); ensure no false negatives
- [ ] Very small/fast body through ultra‑thin wall (1‑2 px): no tunneling at 1 substep with CCD on
- [ ] Overlap at t=0: TOI=0, normal from EPA; resolve without NaNs
- [ ] Backface hits on half‑space: ignore when moving away (n·v ≥ 0)

### 4.4 Fuzzing & Property Tests
- [ ] Random convex pairs (seeded): CCD t must be ≤ discrete‑ref t at N=256 substeps (within epsilon)
- [ ] Minkowski difference monotonicity: support steps never increase penetration along the advancement ray
- [ ] Idempotence near grazing: toggling CCD on/off should not add energy

### 4.5 Performance & Stability
- [ ] CCD triggers count vs speed threshold (telemetry histogram)
- [ ] Per‑frame time budget under stress scenes (≤ 2 ms on mid‑range)

### 4.6 Integration Scenarios (Sandbox)
- [ ] Thin Wall: fast OBB & CIRCLE bullets at 1 substep → no tunnel
- [ ] Angled Ramp: correct first contact point & normal at TOI
- [ ] Wedge Funnel (convex POLYGON): first edge wins, no double‑hits
- [ ] Corner Kiss: ray at 45° into OBB vertex; verify policy behavior
- [ ] Circle Glance: CIRCLE tangent to slope, no TOI jitter

---

## Progress Notes

- [x] Manifold v2 type + enum shapes (no magic strings) (0ae34b6)
- [x] Emit `collision-v2` with mandatory fields (method/iterations/features/depths) for discrete path (0ae34b6)
- [x] Added impulse events (normal/friction) (cf77924)
- [x] Collision overlay: contacts, normals, impulses, gravity, center→contact lines, labels (cf77924)
- [x] Physics Dashboard (draggable) with toggles and event inspection (8c57f60)
- [x] Unit tests for manifolds and impulses (cf77924, 0ae34b6)
- [x] Initial swept TOI hooks (linear-only, binary search) populate `tCollision` for OBB↔AABB/OBB and dynamic pairs (resolution still discrete) (e007e02; src/engine/ccd/sweptTOI.ts)
- [x] Axis-aligned fast paths in `sweepTOI` (OBB↔OBB, OBB→AABB) with unit tests (2c9db34)
- [x] Rotated OBB↔OBB via swept-SAT across {A.ux,A.uy,B.ux,B.uy} (fixed orientation) with unit test (35086e7)
- [x] Thin Wall acceptance spec at unit level via `advanceWithCCD` harness (no tunneling @ 1 substep); engine integration pending (b7c48cd, fdb9364)
- [x] Ray slabs (AABB/OBB local-frame) and circle–circle analytic TOI with unit tests (9c4f056, d0dc200)
- [x] `CcdStepperSystem` + `CcdSettingsState` skeleton integrated to advance supplied bodies via CCD (no feature flags; controlled by thresholds) (9c4f056)
- [ ] Replace discrete resolution with TOI-ordered resolution (engine scheduler)
- [ ] Add ray/segment analytic tests and dashboard tooling
- [ ] Implement general GJK‑TOI + EPA kernel; extend swept coverage to POLYGON and CIRCLE

> ASCII reference for the “glance” case (circle meets a slope):
>
> ```
>   0/\
>   /
> ```
> Interpret as a circle just touching a rising edge; treat as tangential contact (t=0 touch or no-enter by policy), and ensure normal selection is stable.

---

## 5) File & Module Plan
- [ ] `src/engine/ccd/support.ts` — shape support functions (AABB/OBB/POLY/CIRCLE)
- [ ] `src/engine/ccd/gjk.ts` — GJK distance + raycast / conservative advancement
- [ ] `src/engine/ccd/epa.ts` — EPA for normal/penetration on touch
- [ ] `src/engine/ccd/sweep.ts` — sweepTOI orchestration + options
- [ ] `src/engine/ccd/sweptSat.ts` — (optional) swept SAT fast path
- [ ] `src/engine/queries/ray.ts` — ray/segment helpers (slabs, plane, circle)
- [ ] `src/engine/ccd/__tests__/*` — unit/property tests
- [ ] RigidSystem/PhysicsSystem integration (initial integration path, always on once merged)
- [ ] Debug UI: CCD toggles + overlay of TOI point/normal
- [ ] Docs: `docs/engine/ccd.md` (algorithms, epsilons, pitfalls)

---

## 6) Acceptance Criteria (Done = All Green)
- [ ] No tunneling for canonical “Thin Wall” at 1 substep (configurable threshold)
- [ ] All pairwise cells in Section 1 flipped to ✅ (swept), with tests
- [ ] Deterministic outcomes with fixed seeds; no flaky grazes
- [ ] Telemetry shows bounded CCD iterations; perf within budget
- [ ] Debug overlay renders TOI point/normal when CCD triggers
- [ ] README/docs updated with CCD notes and tradeoffs

---

## 7) Nice‑to‑Haves (Post‑MVP)
- [ ] Angularly‑aware TOI (conservative advancement including rotation)
- [ ] Warm‑start contact caching at TOI for next frame
- [ ] Hybrid broad‑phase (temporal coherence + cell hash)
- [ ] SAT/GJK switch heuristics based on feature counts

---

## 8) Tracking
Use this checklist to track progress. For each item:
- Check it when implemented.
- Link to the commit / PR (or note the SHA) and the test(s) that validate it.
