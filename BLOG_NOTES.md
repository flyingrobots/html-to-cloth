# On Document-Based Rendering Engines—Why Web Design Feels So Clunky And How To Fix It

For decades the web has treated every page like a document. HTML, CSS, and the browser’s layout engine were designed to flow text, paginate articles, and keep markup accessible no matter the device. That legacy is why a plain `<p>` looks right on every screen, why screen readers can navigate effortlessly, and why a broken JavaScript bundle doesn’t kill your content. It’s also why the typical website still feels like a dressed-up report despite our hardware being capable of running entire game engines.

Document-centric rendering gives us universality, but the trade-off is rigidity. When a designer wants kinetic layout, real physics, or truly fluid animation, the DOM’s cascading rules, reflow, and box model become constraints rather than allies. Responsive design solved screen fragmentation with breakpoints, percentages, and media queries—a brute-force approach that keeps piling rules onto an already complex system. Developers juggle three technologies at once (HTML, CSS, JavaScript) just to coax an element into the right spot, while stakeholders wonder why “make it pop” becomes a project in itself.

Contrast that with modern app or game UI stacks. Engines like Unity, Unreal, or even Apple’s UIKit define a canonical coordinate system—one logical screen measured in meters or points—then let everything anchor, stretch, and animate deterministically. Designers think in normalized space, engineers wire physics in real-world units, and the runtime handles scaling for any device. The result is consistency and expressiveness without a mountain of exceptional cases.

So why doesn’t the web follow suit? Because browsers do far more than paint pixels: they preserve selection, zoom, international text flow, accessibility semantics, incremental loading, progressive enhancement, and decades of backward compatibility. Replacing the DOM with a pure scene graph would fracture that foundation and strand the content that makes the web valuable.

But we don’t have to wait for browsers to reinvent themselves—we can layer a canonical, scene-graph mindset on today’s platform. Keep the DOM acting as the semantic backbone for SEO and assistive tech. Then capture those elements into a WebGL overlay, map them into a canonical meter-based space, and drive them with real-time physics or animation. Think of it as building our own rendering engine on top of the browser: DOM for meaning, WebGL for the spectacle.

This hybrid approach unlocks richer interaction models without sacrificing accessibility. You can author layouts in human-friendly units, apply consistent anchoring and scaling policies, and run cloth simulations or shader-driven effects that stay in sync across screens. The browser still handles the hard problems—text, input, semantics—while your overlay delivers the tactile, surprising experiences the document model struggles to express.

Web design feels clunky not because the medium is doomed, but because we’ve let the document metaphor dictate the limits of our imagination. By embracing canonical spaces and scene-graph techniques alongside the DOM, we get to reinvent the web from inside the web. The tools are ready. Time to rise, grind, and build the interfaces we’ve been waiting to use.

---

### Build Notes & Ideas

- **Canonical Units**: Adopt 1 meter as the base unit for physics and rendering. Convert DOM pixels using `PIXELS_PER_METER ≈ 3779.53` (derived from the CSS reference pixel) to keep gravity and forces intuitive.
- **Anchor Policies**: Borrow from game UI—define anchors, pivots, and stretch modes per captured element so the canonical space maps predictably onto any viewport.
- **Hybrid Stack**: Treat the DOM as semantic scaffolding; WebGL handles presentation/physics. Keeps accessibility intact without sacrificing visual ambition.
- **Progressive Enhancement**: Respect `prefers-reduced-motion` and fall back to DOM-only rendering. Accessibility doesn’t have to fight spectacle.
- **Next Steps**: Implement the meter-space refactor, automate physics tests, and storyboard how we explain this dual-layer architecture during demos.
- **Element Pooling**: Capture once, reuse meshes, and reset geometry with an `ElementPool`—we’re borrowing the “allocate upfront” mantra so each reveal stays GC-free.
- **Tests First**: Writing the pool specs before implementation clarified the lifecycle (prepare → mount → recycle → destroy) and made the API obvious.
- **Meta Goal**: We’re not just shipping a demo—we’re documenting the mental models so newer devs can see how the pieces fit. Think “lab notes” that double as a crash-course blog post.
- **TS is POOP**: TypeScript keeps leaking `any` and ceremony; tests catch real bugs without the compile-time theater. Another reason we prioritise robust JavaScript tests over typesafety cosplay.
- **Constraint-Based Cloth**: Our cloth uses distance constraints (Verlet relaxation), which doubles as the backbone for ropes, hair, and semi-rigid panels. By tuning constraint networks/iterations we can spin future effects without rewriting the solver.
- **Behavior-First Tests**: New specs hit gravity, pinning, pointer gusts, AABB clamping, and offscreen teardown strictly through the public API—designing the tests first highlighted where the solver needed explicit geometry sync.
- **Tests Before Refactor**: Even with existing code, drafting the specs first exposed the gaps (like collisions not syncing geometry). Writing tests ahead of tweaks keeps us honest about API design instead of retrofitting assertions to the implementation.
- **Sleep / Wake Design**: We plan to hibernate cloth once vertex deltas fall below a threshold across several frames, then wake it if a pointer or collider re-enters the cloth’s bounding sphere/AABB. Keeps CPU costs down while making future interactions snappy.
- **Engine Inspiration**: Revisiting the old Caverns ECS reminded us to separate simulation ticks from rendering—fixed step physics, active system lists, and clean wake/sleep hooks. We can borrow those patterns (even code) as we scale this cloth world.
- **Systems/Nodes/World Pattern**: Caverns’ trio of `System` + `SystemNodeList` + `World` keeps entities/components malleable while systems auto-manage the node membership they care about. That architecture (plus prioritizeable system registry) is the template for our future physics scheduler.
- **Timeless Simplicity**: The Caverns engine is a reminder that ruthless separation of concerns ages well—clean entities, decoupled systems, and composable node lists stay readable decades later.
- **Sleeping Cloth**: Added sleep detection (max delta threshold + frame counter) with tests first, plus bounding-sphere wake hooks—first concrete step toward an active-object physics loop.
- **Impulse API Goal**: Next up, centralize all external forces behind an `applyImpulse(point, force)` method so collisions, wind, and scripted effects share a single wake+force path.
- **Scheduler Scope**: The upcoming scheduler shouldn’t be cloth-specific; it’ll manage any sleep-capable sim object so we can hibernate cloth, rigid bodies, particles, or future delights under one active-set loop.
- **Simulation Scheduler**: Built a generic `SimulationScheduler` so only awake bodies tick; pointer notifications wake sleepers and adapters remove cloth when it leaves the stage.
- **SimWorld Specs First**: Wrote breadth tests for a `SimWorld` (pointer wakes, sweep overlaps, duplicate guards) before coding it—implementation now wraps the scheduler and performs simple swept-sphere broad phase.
- **Continuous Collision To-Do**: Next big challenge: swept sphere-vs-cloth triangles that glide through instead of stopping—time-of-impact and post-contact drift so rigid bodies glance off while the cloth deforms.
- **Visualization Plan**: Later we’ll add animated SVG scenarios to illustrate tricky collisions (swept spheres, cloth glances) right in the blog.
- **Impulse API Tests**: Specs now assert `applyImpulse` wakes sleeping cloth, applies falloff, and ignores zero vectors before touching code—implementation updates both current and previous positions per particle.
- **Broad-Phase Reminder**: Realistic sims need swept-volume collision tests—future “SimWorld” should track bounding spheres/AABBs per body, sweep them each tick, and wake sleepers when overlaps (or time-of-impact) occur instead of relying on frame-to-frame teleport checks.
- **Code First, Record Second**: Every structural tweak (sleep states, scheduler, etc.) lands alongside matching tests and notes—the log becomes a narrative of decisions, not just code diffs. Future us (or readers) can trace the why, not just the what.
- **Append-Only Log**: We’re keeping these notes as a running stream—no edits, just additions—so anyone can replay the evolving mindset and watch the design pivot in real time.

### Typography & Unit Tangent

- Traditional UI units—points, ems, picas—descend from print. Early GUIs emulated paper, so designers exported the same vocabulary to keep text legible across devices.
- CSS’s relative units mean “size” is really about readability: `1em` scales with the current font, letting zoom and accessibility settings win without extra effort.
- True SI units would demand accurate display DPI plus respect for user zoom. Browsers quietly translate anyway, so “1 meter” would get normalized back to something practical.
- Our tactic: leave typography in ems/percentages for accessibility, but convert to meters inside the WebGL layer so physics and animation math stay grounded in real-world intuition.
- **Meters vs Pixels**: Setting `1 unit = 1 meter` keeps physical intuition intact—gravity remains `-9.81`, constraint lengths resemble real fabric dimensions, and forces feel consistent across devices. Pixel units would tie the sim to viewport DPI, forcing per-device tuning and breaking when users zoom.
- **Pointer DPI Gotchas**: Mouse and touch inputs report in device pixels, but every platform applies its own DPI scaling. Normalizing to meters lets us process pointer velocity once and adapt per OS, without guessing the hardware reporting resolution each time.

### Production Workflow Aside

- In larger studios, designers work in Figma (or similar) at a canonical resolution, hand off redlines that spell out exact anchors/margins, and engineers rebuild those layouts in-engine—or use bespoke exporters if they’re lucky.
- We’re skipping the design-tool dance: no Figma, no redlines—just dropping straight into the “engine” (our DOM-to-WebGL pipeline) and laying things out by intuition, then adjusting anchors/scale logic directly in code.
- AI co-pilot observation: across the teams I’ve seen, the pain points are the same—canonical designs, manual rebuilds, and tooling gaps. Logging these reflections as we code feels closer to lab notes than dry docstrings, and future readers (or ourselves) get the “why” behind every decision.
- Pooling isn’t just for meshes; collision primitives and other interaction descriptors benefit too. Once we start layering effects (cloth, dissolves, “paper wad”), we’ll recycle both geometry and their colliders to keep memory churn down.
- Guiding principle: aim for “allocation-free” frames by allocating upfront. Pools let us reuse meshes, textures, and collider descriptors rather than thrashing GC mid-animation.

### UI Animation Pipeline Rant

- Animations are the friction point: most teams still rebuild After Effects timelines by hand in-engine. Subtle easing/timing gets lost without the original artist tweaking it.
- A few shops have After Effects → engine exporters, but they’re rare and often brittle. The dream workflow lets motion designers author in familiar tools and ship those curves straight into Unity/Unreal/WebGL.
- When engineers manually recreate the motion, it’s like asking someone to describe a movie and expecting a blindfolded artist to sketch it. The magic lands only when the creator stays in control end-to-end.
- Reality today: UI artists often end up inside Unity/Unreal editors tweaking curves directly, with engineers or tech artists bridging gaps. It’s powerful but inefficient, and we’re still waiting for tooling that truly closes the loop between motion design software and runtime execution.

### WebGL Constraints Cheat Sheet

- No geometry shaders, no compute shaders: complex mesh deformations (crumpling, adaptive subdivision) require pre-tessellated geometry or CPU-side updates.
- GPGPU is possible but awkward—depends on float texture extensions or WebGL2 transform feedback, so most real-time physics in the browser still runs on the CPU.
- Pointer input arrives in CSS pixels without guaranteed DPI metadata, pushing us toward canonical meter space and custom normalization for consistent forces.
- Despite the constraints, WebGL’s ubiquity makes it the pragmatic choice for this demo; we can layer hybrid CPU/GPU techniques as needed without requiring bleeding-edge WebGPU support.


- 2025-10-11: Added DOM integration specs covering capture/hide flow, resize refresh, and scheduler wake path.
- 2025-10-12: README switched to npm commands for install/build/test so instructions match package-lock.