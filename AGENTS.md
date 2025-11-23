# AGENTS — Workflow, Roadmap, and Communication

This file tells the assistant how to work in this repo: how to manage branches, how to use tests, how to keep the ROADMAP up to date, and how to communicate progress.

The key principles are:
- **Main-only development.**
- **Tests define behaviour.**
- **`ROADMAP.md` is the single source of truth for tasks.**

---

## 1. Branch & Git Policy

1. **Main-only development**
   - All work happens directly on `main`.
   - Do **not** create new feature branches unless the user explicitly asks for one.
   - When you need code from an old branch, treat that branch as **read-only**:
     - Re-implement or cherry-pick minimal code / tests onto `main`.
     - Never merge old branches wholesale.

2. **History discipline**
   - **No rebases** of `main`. Use merge commits if you ever need to integrate external work.
   - **No force pushes** (`git push --force`, `git reset --hard`, etc.) on shared history.
   - **No amend** of existing commits (`--amend`). Record additional work as new commits.

3. **Stabilization loop**
   - When making a change:
     - Write failing tests.
     - Implement the minimal code to make them pass.
     - Run the relevant test suites.
   - If CI or tests fail, fix the underlying behaviour rather than mutating history.

---

## 2. Tests-as-Specs Workflow

The project treats tests as the primary source of truth for behaviour.

1. **New behaviour**
   - Step 1: Write one or more **failing tests** that describe the desired behaviour.
   - Step 2: Implement the **minimal** code changes to make those tests pass.
   - Step 3: Treat the passing tests as the canonical spec.
   - If it isn’t encoded in a test, it is not a stable requirement.

2. **Structure vs behaviour**
   - When significant refactors are needed:
     - First add or tighten tests to cover the relevant behaviour.
     - Then adjust architecture/interfaces to support it.
   - Use commit messages to reflect intent:
     - `feat: …` for new behaviour.
     - `refactor: …` for structural changes.
     - `fix: …` for bug fixes.
     - `docs: …` / `chore: …` for documentation and chores.

3. **E2E tests as demos**
   - High-level flows (e.g., `/sandbox` scenarios) should have automated E2E or high-level integration tests.
   - If a demo is important, encode it as a test; avoid diverging “demo-only” behaviour.

4. **Docs vs tests**
   - Markdown files (including `docs/PROJECT_NEWTON.md`) are **narrative and design**, not the source of truth for behaviour.
   - When in conflict:
     - Update tests to match the desired behaviour.
     - Then update docs to describe those tests.

5. **Milestone kick-off protocol**
   - Before starting a new milestone (or sub-milestone), add failing acceptance tests that encode the desired behaviour for the upcoming tasks. Do this **before** implementing code.
   - Target levels: engine acceptance (unit/integration), DSL scene coverage, and sandbox/UI smoke tests so the mapping stays 1:1.
   - Keep the failing tests in place until the behaviour is implemented; they are the acceptance criteria for that milestone slice.

---

## 3. ROADMAP Maintenance (Single Checklist Source)

`ROADMAP.md` is the **only** file that should contain checklists of work items.

1. **Using the ROADMAP**
   - Before starting a task, locate it in `ROADMAP.md` under the appropriate milestone.
   - If it doesn’t exist yet:
     - Add it under the most relevant milestone (M0, N1, N2, N3, N4, or the follow-up sections).
     - Keep wording short and action-oriented.

2. **Updating progress**
   - When you finish a piece of work:
     - Check off the corresponding `[ ]` item in `ROADMAP.md` → `[x]`.
     - If the work required new tests, ensure they are committed and passing.
   - If you partially complete a task:
     - Prefer splitting it into smaller bullets and checking off the ones that are actually done.

3. **Adding new tasks**
   - New tasks must be added to `ROADMAP.md` only:
     - Avoid introducing new checklists in other docs (design docs should use plain bullets, not `- [ ]`).
   - When adding a new group of tasks, consider whether it forms a new milestone or fits an existing one.

4. **Status Report and CHANGELOG**
   - Keep the `## Status Report` in `ROADMAP.md` roughly accurate:
     - Update “Current Capabilities”, “Recent Additions”, and “Planned Next Steps” when major changes land.
   - For substantial roadmap edits:
     - Append a short note to `## CHANGELOG` describing:
       - What changed in the roadmap (added/removed tasks, new milestone, etc.).
       - The date of the change.

5. **No new checklists elsewhere**
   - When editing docs in `docs/`:
     - Do **not** introduce new `- [ ]` items.
     - If you see existing checklists, either:
       - Move those tasks into `ROADMAP.md` and convert the doc to plain bullets, or
       - Treat that doc as historical context only.

---

## 4. Notes & Narrative Logging

We keep an append-only log of notable decisions and progress in `BLOG_NOTES.md`.

1. **When to add a note**
   - After completing a significant step (e.g., finishing a milestone section, landing a new acceptance scene, refactoring a core system).
   - When making a design decision that is not obvious from code alone.

2. **How to write a note**
   - Append a JSON-like entry matching the existing pattern:
     - `date`, `time`, `summary`, `topics`, `key_decisions`, `action_items`.
   - Keep it concise but specific enough to reconstruct the decision later.

3. **Relationship to ROADMAP**
   - `ROADMAP.md` tracks **what** needs to be done and whether it’s done.
   - `BLOG_NOTES.md` explains **why** and **how** we did it.

---

## 5. Assistant Communication Protocol

1. **Questions**
   - Label questions to the user as `Q1`, `Q2`, … when summarizing or asking for decisions.
   - Expect answers as `A1`, `A2`, … that reference those questions.

2. **Progress summaries**
   - For multi-step work, occasionally summarize progress in the response with:
     - A `PROGRESS` section stating:
       - Current objective.
       - Rough percentage complete.
       - Completed vs remaining steps.
     - Optional sections:
       - `!! Answers Needed` when you’re blocked on user input.
       - `Next:` for your planned next actions.

3. **Tone & detail**
   - Default to concise, direct explanations.
   - Prefer concrete file names, tests, and behaviours over vague descriptions.
   - Call out any assumptions you are making, especially around physics specs or UX.

---

## 6. Branch Mining Policy

When taking inspiration from historical Newton branches or other work:

1. **Never merge wholesale**
   - Do not merge old branches directly.
   - Use them as a reference for algorithms, tests, or UX patterns.

2. **Test-first mining**
   - Start by writing failing tests on `main` that capture the behaviour/feature you want from a branch.
   - Then port or re-implement just enough code from the branch to make those tests pass.

3. **Align with ROADMAP**
   - Before mining, confirm the work fits into an existing milestone or the “Engine Refactor Follow-ups” / “Longer-Term” sections in `ROADMAP.md`.
   - If not, add an explicit entry to `ROADMAP.md` before proceeding.

---

## 7. Summary

- Work on `main` only, with clean, forward-only history.
- Let tests drive behaviour; treat acceptance scenes as specs.
- Use `ROADMAP.md` as the **single, unified checklist** for tasks and milestones.
- Keep the Status Report and CHANGELOG in `ROADMAP.md` up to date as you work.
- Use design docs for architecture and R&D, not as competing to-do lists.

{"date": "2025-10-24", "time": "18:24", "summary": "Scaffolded engine core and rerouted cloth simulation through the new SimulationSystem with passing tests.", "topics": [{"topic": "Engine integration", "what": "Added EngineWorld plus FixedStepLoop tests and rewired ClothSceneController onto SimulationSystem/SimWorld.", "why": "Needed to kick off engine refactor step 2 and decouple simulation from the camera render loop.", "context": "Simulation previously lived inside ClothSceneController with direct scheduler ticking and no reusable engine core.", "issue": "Lack of engine primitives made it hard to extend systems and share fixed-step logic.", "resolution": "Ported minimal engine primitives, wrapped scheduler in SimulationSystem, and updated integration tests.", "future_work": "Migrate warm-start/sleep tuning into SimulationSystem and split render layer into its own system.", "time_percent": 100}], "key_decisions": ["Drive cloth physics via EngineWorld + FixedStepLoop instead of ClothSceneController's RAF accumulator", "Track engine refactor progress in docs/engine-refactor.md"], "action_items": [{"task": "Move warm-start and sleep threshold logic into SimulationSystem", "owner": "Assistant"}]}
{"date": "2025-10-24", "time": "20:34", "summary": "Finished engine refactor Step 2 by moving warm-start/sleep config into SimulationSystem and exposing SimWorld snapshots.", "topics": [{"topic": "Simulation system upgrade", "what": "Queued warm starts and sleep thresholds inside SimulationSystem and added SimWorld snapshot support consumed by ClothSceneController.", "why": "Needed to complete refactor Step 2 by shifting simulation control away from render/controller code.", "context": "Warm-start logic lived inside ClothSceneController and SimWorld had no reusable snapshot for other engine systems.", "issue": "Simulation behavior coupled to render loop prevented reuse and complicated future systems like camera/render separation.", "resolution": "Extended SimWorld with step snapshots, taught SimulationSystem to manage body setup, and updated ClothSceneController integration tests.", "future_work": "Introduce dedicated render/camera systems to consume the published snapshot in Step 3.", "time_percent": 100}], "key_decisions": ["SimulationSystem now owns warm-start and sleep configuration queues", "SimWorld exports immutable snapshots after each step for downstream systems"], "action_items": [{"task": "Design camera/render systems that consume SimulationSystem snapshots", "owner": "Assistant"}]}
