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
{"date":"2025-10-17","time":"21:25","summary":"Began Mantine migration and JavaScript conversion; build is green while domIntegration specs need tweaks after pointer helper refactor.","topics":[{"topic":"UI stack swap","what":"Removed shadcn/Tailwind, installed Mantine, rebuilt debug palette, restyled hero.","why":"Align with new design direction and eliminate Tailwind dependencies.","residual_risk":"Mantine debug palette UX tuning pending once tests stabilize."},{"topic":"TypeScript removal","what":"Converted shared libraries and tests to JavaScript with JSDoc, dropped tsconfig and TS deps.","why":"Team mandate to ship plain JavaScript with AI-generated docs.","residual_risk":"domIntegration suite still failing due to DOM capture expectations; ElementPool mock updates in progress."}]}
{"date":"2025-10-17","time":"21:27","summary":"Finished Mantine migration and converted the codebase to plain JavaScript while keeping builds and tests green.","topics":[{"topic":"Mantine UI migration","what":"Removed shadcn/Tailwind, rebuilt the debug UI with Mantine, and refreshed styling/tests.","why":"Design direction switched to Mantine; needed to simplify dependencies.","context":"Previous PR introduced Mantine components and pointer-helper tooling but was incomplete.","issue":"Legacy Tailwind/shadcn files and mocks conflicted with new UI flow.","resolution":"Rebuilt layout in Mantine, updated mocks, verified domIntegration suite.","future_work":"Polish Mantine palette interactions once feature work resumes.","time_percent":55},{"topic":"TypeScript removal","what":"Converted libs/tests to JS with JSDoc, dropped tsconfigs and TS deps, added ESLint guard against TS.","why":"Team mandate to deliver pure JavaScript and rely on AI-generated docs.","context":"Project previously depended on strict TypeScript configs and path aliases.","issue":"TS-only tooling blocked builds after Mantine swap.","resolution":"Renamed modules, rewrote typing to JSDoc, updated build/test scripts, enforced ban via ESLint.","future_work":"Monitor code quality with JS-only lint/tests going forward.","time_percent":45}],"key_decisions":["Adopt Mantine as primary UI toolkit","Perma-ban TypeScript via lint enforcement"],"action_items":[{"task":"Tune Mantine debug palette UX once feature iteration resumes","owner":"Team"}]}
