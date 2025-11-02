#!/usr/bin/env bash
set -euo pipefail

MILESTONE="PROJECT: Newton"

# Create milestone (idempotent if exists); omit due date for cross-platform
gh api repos/:owner/:repo/milestones \
  --method POST \
  -f title="$MILESTONE" \
  -f state=open \
  -f description='Physics lab milestone: collisions/observability/UX (Mantine + GSAP)' || true

# Ensure project:newton label exists
gh label create project:newton --color 5319e7 --description "PROJECT: Newton tracking" 2>/dev/null || true
# Common labels used across Newton issues
for L in ui overlay good-first-pr gsap physics collision sat high-priority attrs config observability events behavior polish inspector devtools demo ux performance; do
  gh label create "$L" --color FFFFFF 2>/dev/null || true
done

create_issue() {
  local title="$1"; shift
  local body_file="$1"; shift
  gh issue create \
    --title "$title" \
    --body-file "$body_file" \
    --label project:newton \
    --milestone "$MILESTONE" "$@"
}

create_issue "PR A — Wireframe overlay + glyph legend + Events panel v2" docs/issues/pr-a.md --label enhancement,ui,overlay,good-first-pr || true
create_issue "PR B — GSAP draggable/resizable windows (Debug + Events)" docs/issues/pr-b.md --label enhancement,ui,gsap || true
create_issue "PR C — Rigid OBB collider + SAT vs AABB (core)" docs/issues/pr-c.md --label physics,collision,sat,high-priority || true
create_issue "PR D — Physics data attributes (rigid + cloth)" docs/issues/pr-d.md --label attrs,physics,config || true
create_issue "PR E — Eventing expansion + Drawer details/filters" docs/issues/pr-e.md --label observability,events,ui || true
create_issue "Sandman — Event-driven sleeper reset system" docs/issues/sandman.md --label behavior,polish || true
create_issue "Inspector gizmo (🔍)" docs/issues/inspector.md --label inspector,ui,devtools || true
create_issue "Demo polish: Clothify All Visible + Panel Hide handoff" docs/issues/demo-polish.md --label demo,ux || true
create_issue "Performance budgets & perf meter overlay" docs/issues/perf-budget.md --label performance,observability || true

echo "Created milestone + issues for $MILESTONE"
