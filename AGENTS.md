# Workflow Playbook

1. **Main-Only Development**
   - All work happens directly on `main`. Do **not** create new feature branches unless explicitly requested.
   - When bringing work from an old branch, treat that branch as read-only reference and cherry-pick behaviour/tests onto `main`.

2. **Tests-as-Specs First**
   - Write the failing tests that describe the desired behaviour.
   - Update the notes stream (append-only, timestamp/commit-linked). Today this lives in `BLOG_NOTES.md`; once the git-notebook tool lands it will store notes as empty commits under `refs/notes/*`.
   - Commit (`feat: add specs for …`).

3. **Run Tests**
   - If everything passes unexpectedly, double-check that the tests cover the intent.
   - Otherwise proceed to implementation.

4. **Structure Changes**
   - Adjust architecture / interfaces to support the new behaviour.
   - Append a note entry.
   - Commit (`refactor: prepare for …`).

5. **Behaviour Changes**
   - Implement the logic to satisfy the specs.
   - Append a note entry.
   - Commit (`feat: implement …`).
   - Return to step 3 until green.

6. **Documentation**
   - Update any docs, comments, or checklists.
    - Append a note entry.
   - Commit (`docs: …`).

7. **Complete Task**
   - Tick checklist items, add a summary note.

### Notebook Automation (Future)

We plan to replace manual note edits with a `git-notebook` helper that:

- Uses the current branch name to create/update `refs/notes/<branch>`.
- Records append-only notes as `git commit --allow-empty -m "note"` on the notebook ref.
- Hooks into CI to merge notebook refs alongside feature branches.

Until that exists, keep notes in `BLOG_NOTES.md` following the append-only rule.
   - Commit (`chore: mark … complete`).

8. **Push & PR**
   - Push the branch, open a pull request if not already open.

9. **Verify CI / Reviews**
   - If green and approved, merge.
   - Otherwise address issues.

10. **Feedback Loop**
    - For failing CI or review feedback, circle back to step 4.

This loop keeps history clean: every behavioural change has dedicated tests, structure, docs, and narrative.

---

### Git Operations & Branch Policy (2025‑11‑14 Update)

- **Main-only:** Work directly on `main`. Do not create new branches unless the user explicitly requests one for a specific purpose.
- **No rebases:** Do not rebase `main` or rewrite history. Use merge commits to bring work together.
- **No force operations:** Avoid `git push --force`, `git reset --hard`, or similar destructive operations on shared history.
- **No amend:** Do not amend existing commits (`--amend`). Always create new commits to record additional changes.
- **Merges over rebases:** When integrating work (including old Newton branches), prefer:
  - Write failing tests on `main`.
  - Cherry-pick or reimplement the minimal code needed.
  - Commit on `main` and stabilize (tests, build, lint).

---

### Assistant Communication Protocol

- Questions from the assistant are labeled `Q1`, `Q2`, … in summaries.
- User answers are labeled `A1`, `A2`, … matching the corresponding questions.
- Progress summaries should include:
  - A “PROGRESS” section with rough percentage estimates.
  - Current Objective and Remaining Objectives.
  - Optional sections:
    - `!! Answers Needed` – when the assistant needs decisions or clarifications.
    - `Next:` – describing the assistant’s next planned moves.
    - `!! Next:` – when there are multiple viable next moves and the user should choose an option (e.g., `Please choose: [1-3]`).

---

### Test-First Manifesto — “The Tests ARE the Spec”

Core principles for this project:

- **Tests define behaviour.**
  - New behaviour must be introduced by:
    1. Writing one or more failing tests on `main`.
    2. Implementing the minimal code needed to make those tests pass.
    3. Treating passing tests as the canonical spec for that behaviour.
  - If it isn’t encoded in a test, it is not a stable requirement.

- **Milestones are expressed as test suites.**
  - Progress is measured by:
    - How many targeted tests exist for a capability.
    - How many of them pass.
  - “23% complete” is a valid statement when it means “13 of 56 tests pass”; milestones are not defined by roadmap feelings or demo slides.

- **E2E tests are demos.**
  - High-level flows (e.g., `/sandbox` scenarios) should be exercised by E2E tests.
  - Instead of building separate demo scripts, we treat E2E suites as the demos:
    - If a demo is important, it should be encoded as an automated flow.

- **Docs complement tests, not replace them.**
  - Markdown files (ROADMAP, TODOs, issues) are navigation aids and narrative, not the source of truth.
  - The assistant should prefer:
    - Adding/updating tests to capture requirements.
    - Then updating docs to point at those tests.

- **Branch mining is test-driven.**
  - When harvesting from historical branches (e.g., Newton work):
    - Start by writing failing tests on `main` that capture the behaviour to bring forward.
    - Only then port the minimal code required to satisfy those tests.
    - Never “just merge” a branch without explicit test coverage on `main`.
{"date": "2025-10-24", "time": "18:24", "summary": "Scaffolded engine core and rerouted cloth simulation through the new SimulationSystem with passing tests.", "topics": [{"topic": "Engine integration", "what": "Added EngineWorld plus FixedStepLoop tests and rewired ClothSceneController onto SimulationSystem/SimWorld.", "why": "Needed to kick off engine refactor step 2 and decouple simulation from the camera render loop.", "context": "Simulation previously lived inside ClothSceneController with direct scheduler ticking and no reusable engine core.", "issue": "Lack of engine primitives made it hard to extend systems and share fixed-step logic.", "resolution": "Ported minimal engine primitives, wrapped scheduler in SimulationSystem, and updated integration tests.", "future_work": "Migrate warm-start/sleep tuning into SimulationSystem and split render layer into its own system.", "time_percent": 100}], "key_decisions": ["Drive cloth physics via EngineWorld + FixedStepLoop instead of ClothSceneController's RAF accumulator", "Track engine refactor progress in docs/engine-refactor.md"], "action_items": [{"task": "Move warm-start and sleep threshold logic into SimulationSystem", "owner": "Assistant"}]}
{"date": "2025-10-24", "time": "20:34", "summary": "Finished engine refactor Step 2 by moving warm-start/sleep config into SimulationSystem and exposing SimWorld snapshots.", "topics": [{"topic": "Simulation system upgrade", "what": "Queued warm starts and sleep thresholds inside SimulationSystem and added SimWorld snapshot support consumed by ClothSceneController.", "why": "Needed to complete refactor Step 2 by shifting simulation control away from render/controller code.", "context": "Warm-start logic lived inside ClothSceneController and SimWorld had no reusable snapshot for other engine systems.", "issue": "Simulation behavior coupled to render loop prevented reuse and complicated future systems like camera/render separation.", "resolution": "Extended SimWorld with step snapshots, taught SimulationSystem to manage body setup, and updated ClothSceneController integration tests.", "future_work": "Introduce dedicated render/camera systems to consume the published snapshot in Step 3.", "time_percent": 100}], "key_decisions": ["SimulationSystem now owns warm-start and sleep configuration queues", "SimWorld exports immutable snapshots after each step for downstream systems"], "action_items": [{"task": "Design camera/render systems that consume SimulationSystem snapshots", "owner": "Assistant"}]}
