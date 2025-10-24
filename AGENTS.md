# Workflow Playbook

1. **Branch Per Task**
   - Create a feature branch off `origin/main` before touching code.

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
{"date": "2025-10-24", "time": "18:24", "summary": "Scaffolded engine core and rerouted cloth simulation through the new SimulationSystem with passing tests.", "topics": [{"topic": "Engine integration", "what": "Added EngineWorld plus FixedStepLoop tests and rewired PortfolioWebGL onto SimulationSystem/SimWorld.", "why": "Needed to kick off engine refactor step 2 and decouple simulation from the camera render loop.", "context": "Simulation previously lived inside PortfolioWebGL with direct scheduler ticking and no reusable engine core.", "issue": "Lack of engine primitives made it hard to extend systems and share fixed-step logic.", "resolution": "Ported minimal engine primitives, wrapped scheduler in SimulationSystem, and updated integration tests.", "future_work": "Migrate warm-start/sleep tuning into SimulationSystem and split render layer into its own system.", "time_percent": 100}], "key_decisions": ["Drive cloth physics via EngineWorld + FixedStepLoop instead of PortfolioWebGL's RAF accumulator", "Track engine refactor progress in docs/engine-refactor.md"], "action_items": [{"task": "Move warm-start and sleep threshold logic into SimulationSystem", "owner": "Assistant"}]}
{"date": "2025-10-24", "time": "20:34", "summary": "Finished engine refactor Step 2 by moving warm-start/sleep config into SimulationSystem and exposing SimWorld snapshots.", "topics": [{"topic": "Simulation system upgrade", "what": "Queued warm starts and sleep thresholds inside SimulationSystem and added SimWorld snapshot support consumed by PortfolioWebGL.", "why": "Needed to complete refactor Step 2 by shifting simulation control away from render/controller code.", "context": "Warm-start logic lived in PortfolioWebGL and SimWorld had no reusable snapshot for other engine systems.", "issue": "Simulation behavior coupled to render loop prevented reuse and complicated future systems like camera/render separation.", "resolution": "Extended SimWorld with step snapshots, taught SimulationSystem to manage body setup, and updated PortfolioWebGL integration tests.", "future_work": "Introduce dedicated render/camera systems to consume the published snapshot in Step 3.", "time_percent": 100}], "key_decisions": ["SimulationSystem now owns warm-start and sleep configuration queues", "SimWorld exports immutable snapshots after each step for downstream systems"], "action_items": [{"task": "Design camera/render systems that consume SimulationSystem snapshots", "owner": "Assistant"}]}
