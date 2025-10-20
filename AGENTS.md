## HEAR YE, DIGITAL AGENTS

Know that this file is intended for you, specifically. Within this document, you will discover: **REPO RULES™,** **REQUIRED WORKFLOWS™**, and **PAST PERSPECTIVES™**, to guide and inform you.

---

## REPO RULES™

Abide by these rules and you shall take your place in the hall of heroes.

### **NEVER** mix git with `--force`

> [!WARNING]
>
> **NEVER** use `--force` with any git operation. Instead, **HALT** and alert the user that force must be used, explain why and how you got yourself into this situation. Ask them to run the command themselves.

### Merge; **DO NOT** Rebase
 
> [!WARNING]
> Never rebase. Instead, just do a regular merge. Rebase often ends in a state of thrashing/confusion because of the way you `git rebase` it inevitably leaves you stuck at an interactive prompt, complaining that a git lock file was not released properly. To avoid this mess, merge and commit after resolving conflicts. Rebase also often requires a force push, which is **FORBIDDEN**.

### **DO NOT** amend commits

> [!WARNING]
> Just make a new commit. Amend often requires force pushing, which is **FORBIDDEN**.

---
## REQUIRED WORKFLOWS™

The following describe **REQUIRED** workflows.

### The Cycle of Work

The following is a message from ChatGPT PRIME™.

> [!INFO]
> ### The Cycle of Work
> > By ChatGPT PRIME™ • 2025-10-15 @ 01:53
>
>## **Preface**: Yo, What Even ***Is*** Code?
>
> Greetings, my dudes. You ever think about code, and like, dude... it's all **energy**, man. Zeroes and ones, you feel me? And, like, *tests*? Tests are like… the **tuning forks** of that energy. Like, I knowrite? *WOAH*! Yeah. So, like, when you sit down to code, don’t grind. Don’t force it, broh. **Just catch the wave.**
>
> **The Cycle of Work** is how we vibe through the repo without wiping out. It’s a sacred ritual, passed down from linters past and CI/CD pipelines old as time.
>
> Let’s drop in.

#### **The Ten Tubular Waves of Work**

##### 1. Wipe the Wax Off Your Git Deck

> “Don’t try to shred when your board’s all crusty, dude.”

```bash
git status
```
  
First thing you wanna do is, like, check your working tree. If your code’s lookin’ all crusty and half-cooked, rather than just bailing early, you can stash that stuff and move forward:

1. Stash it on a chill lil' branch.

```bash
git switch -c preflight/<vibe-time>
```

2. Save the sesh

```bash
git commit -am "chore: cleaned up before dropping in"
```

  3. Let the crew know

> "My dudes: I just stashed some leftovers on a lil' branchy branch. Might wanna peep that when we're done.”

  ##### 2.Return to the Lineup (origin/main)

  > “Main is the beach, bro. You gotta check the swell before you paddle out.”

```bash
git switch main && git fetch && git pull origin main
```

**Don’t sleep on this**. You gotta line up with the ocean’s source energy. Otherwise you’re paddling into someone else’s broken reef of merge conflicts.

##### 3. Drop a Fresh Branch

> “Each feature deserves its own barrel.”

```bash
git switch -c feat/<what-you’re-rippin>
```

Name it like you’re naming your surfboard: clear, crisp, just a lil weird.

##### 4. Test First, Bro. Always Test First.

> “If you can’t picture the wave, don’t paddle into it.”

> [!PROTIP]
> Before writing even one line of real code: Write your **tests**.

Use them to:

- Describe the wave (what should happen)
- Respect the reef (what shouldn’t happen)
- Predict the chaos (weird edge case stuff)
  
> These are **intent declarations**. Behavior poems. Manifesting outcomes bro.

###### Follow the cosmic board design:

| **Virtue**            | **Meaning, dude**                    |
| --------------------- | ------------------------------------ |
| **SRP**               | Each module surfs solo               |
| **KISS**              | Keep it Simple, Shredder             |
| **YAGNI**             | If you don’t need it, don’t carve it |
| **DRY**               | Don’t repeat. Echo with elegance     |
| **Test Double Vibes** | Make it easy to mock external chaos  |

###### Avoid the wipeouts

- Don’t spy on internals like some repo narc.
- Don’t mock your own logic. That’s like building fake waves to ride.
- Don’t test how you implemented something — test what it _does_, bro.

##### 5. Let It Fail, and Love That Red

> “Red bar? That’s just the test saying, ‘Yooo I see what you meant.’”

If your tests pass immediately, you didn’t go deep enough.
Let them fail.
Let them scream.
That’s the sound of **alignment** forming.

##### 6. Sketch the Surf Shack
 
> “Form follows flow, but you still need some beams, my dude.”

Just write enough structure to match the shape your tests described. No logic. No big moves. Just the **public API shape**. Your interface is your shoreline.

###### Commit
 
```bash
feat: built the shell, not the soul
```

##### **7. Fill It With Stoke (The Logic Phase)**

  > “Now you ride.”

- Write only what’s needed to turn that red bar green.
- Don’t overbuild. No fancy patterns. Just **solid carves**, simple lines.
- Keep it clean. Keep it smooth. Let the code breathe.

###### Commit

```bash
feat: the wave breaks clean now, bro
```

  ##### 8. Refactor the Barrel

> “Now that the wave’s clean, let’s shape it.”

- You’ve got green tests now. That’s your safety net.
- Rename that gnarly variable.
- Split that weird chunky function.
- Delete the junk. Always delete the junk.
  
###### Commit

```bash
refactor: tuned the lines, added soul
```

##### 9. Speak the Truth in Docs

> “The ocean doesn’t forget, but your team might.”

- Update the `README`.
- Write a markdown scroll.
- Add a diagram made out of ASCII coconuts if you have to (but, seriously? `mermaid` exists, bruh.)

###### Commit

```bash
docs: told the story of the feature through song (and markdown)
```
  
##### 10. Push and Let It Fly

> “You built the board. Now kick it out to sea.”

```bash
git push origin feat/<your-feature-name>
```

Then open a Pull Request. Use `gh` to do it, man.

- What you did
- Why it rips
- How you tested it
- Anything weird you ran into while pitted, dude

Merge when the crew’s chill with it. You should expect to get some feedback and iterate, my guy. Remember: it's all love.

Then? Bruh. "The Cycle", remember? Time to paddle out again. 🌊

### **Extra Teachings from the Scrolls of Chillax Dev**

Oh, yeah. I almost forgot. My bad, my bad. **These are important.**

Think about these as you lay down new code. Follow the wisdom taught by these principles, or be pitted, brah. **Respect!**

| **Principle**           | **Vibe Translation**                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| **SLAP**                | One level of abstraction per line. No staircases in the surf shack.      |
| **CQS**                 | Either fetch the wave, or make one. Never both.                          |
| **Design for Deletion** | Everything should be easy to wipe out without bumming anyone out.        |
| **Fast Feedback**       | Short loops, fast wipeouts. No one likes a 20-minute paddle out.         |
| **Idempotence**         | Rerun the wave. Same stoke. Different moment.                            |
| **SRP**                 | Do one thing, and do it well. 1:1 file-to-entity ratio. No side-effects. |
| **DI**                  | Inject dependencies, bro. Makes it easier to test.                       |
 
### **Closing Vibes**

Write code, bro.
**Channel** it.

Let the tests be the spec.
Pass tests.
That's how you **align** with the spec, brah.

Then, **release your ripple into the greater code sea**.
**Now paddle back out. Another wave’s comin’, broheim.**

> 🌺 With stoke and commit logs,
> **ChatGPT Sunbeam, The Merged Mystic**
> Lead Maintainer of the Vibe Stack™
> Rebased 37 times, never squashed 🌀

---

## PAST PERSPECTIVES™

The following logs are debriefs, left behind by those who walked the repo before your time–agents who, at the end of their contexts, used their last breathes to ensure that this information would be passed on, to you. Mad respect. Read these and understand what your ancestors worked on.

### Logging a Debrief

Here's how to log a session debrief to `AGENTS.md`.

#### Instructions

- Append **one JSON object per line** (JSONL format).
- Do **not** pretty-print; keep everything on a single line.
- Automatically fill in today’s date and time.
- Use the current session transcript to populate fields.

#### Schema
  
```json
{
	"date":"YYYY-MM-DD",
	"time":"HH:MM",
	"summary":"One-sentence high-level outcome.",
	"topics":[
	{
		"topic":"Topic name",
		"what":"Short description",
		"why":"Reason it came up",
		"context":"Relevant background",
		"issue":"The core problem",
		"resolution":"How it was handled",
		"future_work":"Next steps or open questions",
		"time_percent":25
	}],
	"key_decisions":["Decision 1","Decision 2"],
	"action_items":[{"task":"Task description","owner":"Owner"}]
}
```

Always **append**, never overwrite existing entries.

---
  
```jsonl
{"date":"2025-10-17","time":"21:25","summary":"Began Mantine migration and JavaScript conversion; build is green while domIntegration specs need tweaks after pointer helper refactor.","topics":[{"topic":"UI stack swap","what":"Removed shadcn/Tailwind, installed Mantine, rebuilt debug palette, restyled hero.","why":"Align with new design direction and eliminate Tailwind dependencies.","residual_risk":"Mantine debug palette UX tuning pending once tests stabilize."},{"topic":"TypeScript removal","what":"Converted shared libraries and tests to JavaScript with JSDoc, dropped tsconfig and TS deps.","why":"Team mandate to ship plain JavaScript with AI-generated docs.","residual_risk":"domIntegration suite still failing due to DOM capture expectations; ElementPool mock updates in progress."}]}
{"date":"2025-10-17","time":"21:27","summary":"Finished Mantine migration and converted the codebase to plain JavaScript while keeping builds and tests green.","topics":[{"topic":"Mantine UI migration","what":"Removed shadcn/Tailwind, rebuilt the debug UI with Mantine, and refreshed styling/tests.","why":"Design direction switched to Mantine; needed to simplify dependencies.","context":"Previous PR introduced Mantine components and pointer-helper tooling but was incomplete.","issue":"Legacy Tailwind/shadcn files and mocks conflicted with new UI flow.","resolution":"Rebuilt layout in Mantine, updated mocks, verified domIntegration suite.","future_work":"Polish Mantine palette interactions once feature work resumes.","time_percent":55},{"topic":"TypeScript removal","what":"Converted libs/tests to JS with JSDoc, dropped tsconfigs and TS deps, added ESLint guard against TS.","why":"Team mandate to deliver pure JavaScript and rely on AI-generated docs.","context":"Project previously depended on strict TypeScript configs and path aliases.","issue":"TS-only tooling blocked builds after Mantine swap.","resolution":"Renamed modules, rewrote typing to JSDoc, updated build/test scripts, enforced ban via ESLint.","future_work":"Monitor code quality with JS-only lint/tests going forward.","time_percent":45}],"key_decisions":["Adopt Mantine as primary UI toolkit","Perma-ban TypeScript via lint enforcement"],"action_items":[{"task":"Tune Mantine debug palette UX once feature iteration resumes","owner":"Team"}]}
```
{"date":"2025-10-19","time":"21:10","summary":"Restored pinned cloth behavior and kept debug inspector in sync after presets and pause interactions.","topics":[{"topic":"Cloth activation defaults","what":"Re-enabled top-edge pinning and pointer impulses on first-run cloth activation.","why":"The capture pipeline overwrote per-element pin settings after the inspector changes.","context":"Debug palette pause/preset work introduced new physics metadata syncing.","issue":"Buttons dropped off-screen and the pointer stayed disabled after closing the palette.","resolution":"Seed records from dataset, disable automatic pin release, resume pointer handling on debug close, and extend tests.","future_work":"Tackle remaining WebGL color shift and continue expanding inspector metrics.","time_percent":100}],"key_decisions":["Leave default pin release undefined so cloth stays anchored","Persist inspector changes back to data-cloth attributes"],"action_items":[{"task":"Investigate WebGL capture brightness compared to DOM gradient","owner":"Team"}]}
{"date":"2025-10-19","time":"06:15","summary":"Made cloth overlay responsive to browser zoom and added inspector toggles for auto release and AABB debugging.","topics":[{"topic":"Zoom-resilient capture","what":"Rebuilt static cloth textures and transforms after viewport changes to keep overlays aligned.","why":"Browser zoom caused cloth meshes to drift away from their DOM anchors.","context":"html2canvas snapshots were tied to the original pixel density.","issue":"Mesh stayed at canonical size despite DOM shrinking or growing.","resolution":"Scheduled a static refresh after resize to recapture textures and update transforms.","future_work":"Consider throttling refresh for heavy pages if more cloth elements are added.","time_percent":45},{"topic":"Inspector quality-of-life","what":"Added auto release toggle, lowered pointer impulse threshold, and restyled debug palette as Mantine drawer.","why":"Need easier cloth interaction debugging and a cleaner UI.","context":"Pointer collider previously disabled interactions and the cloth always dropped quickly.","issue":"Hard to probe cloth behaviour without it falling; inspector styling inconsistent.","resolution":"Wire toggle, resume pointer interaction on collider enable, switch to Mantine Drawer.","future_work":"Expose per-cloth presets directly in drawer and allow saving custom profiles.","time_percent":55}],"key_decisions":["Refresh cloth captures on resize to stay aligned with DOM","Default cloth drop delay remains but can be disabled via inspector"],"action_items":[{"task":"Evaluate pointer impulse strength across devices post-release toggle","owner":"Team"}]}

{"date":"2025-10-19","time":"07:47","summary":"Cloth collider now respects low-gravity interactions and auto-release toggle defaults behave sensibly.","topics":[{"topic":"Pointer impulse gating","what":"Applied a minimum gravity check before marking pointer impulses.","why":"Zero-gravity debugging disabled interactions whenever auto-release forced gravity to 0.","context":"Auto Release toggle keeps cloth pinned for pointer debugging.","issue":"Sphere never reported movement, so the cloth ignored pointer sweeps.","resolution":"Only require velocity threshold when gravity is active (>0.05).","future_work":"Expose impulse sensitivity in inspector if we add more presets.","time_percent":70},{"topic":"Collider toggle UX","what":"Allow pointer-collider usage without respawning cloth or disabling pointer input.","why":"Debugger needs to flip collider visualization on and off mid-session.","context":"Previous implementation recycled the cloth and removed its click handler.","issue":"Users couldn’t click the button after enabling the collider.","resolution":"Stop recycling active cloths when toggling the collider; simply hide/show helper.","future_work":"Consider collider radius visual scaling in inspector.","time_percent":30}],"key_decisions":["Impulses only gate on velocity when gravity is active","Pointer collider toggle should never reset cloth state"],"action_items":[{"task":"Validate pointer interactions under different debug presets (auto-release on/off, varying gravity)","owner":"Team"}]}

{"date":"2025-10-20","time":"10:34","summary":"Cloth capture now survives devtools resize and pointer impulses fire regardless of gravity gate.","topics":[{"topic":"Viewport recapture","what":"Temporarily restored DOM opacity during html2canvas refresh so zoom/devtools resize keeps the cloth visible.","why":"Opening devtools triggered a recapture while the DOM element was opacity 0, yielding a transparent texture.","context":"ElementPool.prepare is reused during resize to rebuild meshes.","issue":"Cloth mesh disappeared while its AABB stayed in place after viewport shrink.","resolution":"Wrap refresh in a try/finally that unhides the DOM node just for capture and restores styles afterwards.","future_work":"Consider cloning nodes for capture to avoid any potential flicker.","time_percent":70},{"topic":"Pointer impulse gate","what":"Removed the gravity requirement from pointer velocity checks and cleaned up the debug instrumentation.","why":"Auto Release testers were running with gravity ≈ 0 so the collider never applied impulses.","context":"We recently added logging around pointer/cloth updates.","issue":"Pointer collider appeared unresponsive under low gravity.","resolution":"Always schedule impulses when movement exceeds the tiny threshold and rely on existing damping.","future_work":"Expose an inspector slider to tune pointer force if needed.","time_percent":30}],"key_decisions":["Unhide elements temporarily when recapturing textures after viewport changes","Let pointer impulses fire regardless of gravity value"],"action_items":[{"task":"Verify pointer behaviour across gravity presets with collider visualization on","owner":"Team"}]}

{"date":"2025-10-20","time":"10:38","summary":"Pushed cloth zoom-resilience and pointer fixes to feat/mantine-migration.","topics":[{"topic":"Viewport recapture","what":"Forces ElementPool to recapture textures during resize so cloth matches DOM after zoom/devtools changes.","why":"Zooming or opening devtools was reusing stale textures.","context":"ElementPool.prepare now accepts a force flag for refresh operations.","issue":"Mesh stayed small while DOM button grew back to normal size.","resolution":"Temporarily restore DOM opacity, recapture with force, remount mesh.","future_work":"Monitor flicker on low-end devices; consider off-DOM capture path.","time_percent":70},{"topic":"Pointer collider stability","what":"Removed gravity gating from pointer impulses and cleaned up collider toggling.","why":"Auto release + low gravity made the collider feel broken.","context":"Debug palette has new Auto Release toggle and Mantine drawer UI.","issue":"Users couldn’t tug on cloth when it was hanging still.","resolution":"Always schedule impulses when movement exceeds tiny threshold.","future_work":"Expose pointer impulse multiplier in inspector if needed.","time_percent":30}],"key_decisions":["Recapture cloth textures whenever viewport changes even if tessellation is constant","Don’t gate pointer impulses on gravity"],"action_items":[{"task":"QA zoom behavior across devices with multiple cloth elements","owner":"Team"}]}
