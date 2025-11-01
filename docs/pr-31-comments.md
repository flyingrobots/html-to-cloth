# PR #31 — feat/mantine ui migration — Comment Digest

Source: gh pr view 31 --json comments,reviews,files

## Summary
- Base: main
- Head: feat/mantine-ui-migration
- URL: https://github.com/flyingrobots/html-to-cloth/pull/31
- Last updated: $(date -u +%Y-%m-%dT%H:%MZ)

---

## General Comments

- CodeRabbit (changes requested): multiple notes across App.tsx, domToWebGL.ts, deps.
- ChatGPT Codex Connector: automated suggestions note.

---

## Actionable Items (extracted)

1) Accessibility — prefers-reduced-motion (App.tsx lines ~292–322)
- Respect reduced-motion and avoid starting the controller when user prefers reduced motion.

2) EngineActions init block duplication (App.tsx ~292–322)
- Ensure single init block; seed actions; avoid redundant `void` and `then`.

3) Affix centering with type-safe values (App.tsx ~455)
- Replace `left: '50%' as any` with numeric or CSS centering without casts.

4) Overlay z-index vs Drawer layering (src/lib/domToWebGL.ts)
- Clarify comment: Drawer zIndex=2100, overlay=1000 → overlay below Drawer. Align code and comment.

5) Dependency compatibility (package.json)
- Align Mantine and React versions (e.g., Mantine >= 7.13.5 with React 19.x) and reinstall.

6) ESLint findings (App.tsx and clothSceneController.ts)
- Remove `any` types in App.tsx around actions/getters; fix empty block statement in controller; add missing deps to useEffect if needed.

---

## Files Mentioned
- src/App.tsx
- src/lib/domToWebGL.ts
- src/app/__tests__/debugActions.test.tsx
- src/lib/clothSceneController.ts
- package.json

