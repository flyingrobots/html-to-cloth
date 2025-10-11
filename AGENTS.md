# Workflow Playbook

1. **Branch Per Task**
   - Create a feature branch off `origin/main` before touching code.

2. **Tests-as-Specs First**
   - Write the failing tests that describe the desired behaviour.
   - Update `BLOG_NOTES.md` (append-only, timestamp or reference the commit).
   - Commit (`feat: add specs for …`).

3. **Run Tests**
   - If everything passes unexpectedly, double-check that the tests cover the intent.
   - Otherwise proceed to implementation.

4. **Structure Changes**
   - Adjust architecture / interfaces to support the new behaviour.
   - Update `BLOG_NOTES.md` (append-only entry for this step).
   - Commit (`refactor: prepare for …`).

5. **Behaviour Changes**
   - Implement the logic to satisfy the specs.
   - Update `BLOG_NOTES.md` (append-only entry for this step).
   - Commit (`feat: implement …`).
   - Return to step 3 until green.

6. **Documentation**
   - Update any docs, comments, or checklists.
   - Update `BLOG_NOTES.md` (append-only entry for this step).
   - Commit (`docs: …`).

7. **Complete Task**
   - Tick checklist items, note lessons in `BLOG_NOTES.md` (append-only summary).
   - Commit (`chore: mark … complete`).

8. **Push & PR**
   - Push the branch, open a pull request if not already open.

9. **Verify CI / Reviews**
   - If green and approved, merge.
   - Otherwise address issues.

10. **Feedback Loop**
    - For failing CI or review feedback, circle back to step 4.

This loop keeps history clean: every behavioural change has dedicated tests, structure, docs, and narrative.
