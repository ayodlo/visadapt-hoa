# Claude Code Project Rules

## Project identity

HOA SaaS

## Hard constraints

none yet

## Conventions

- Files: components `PascalCase.tsx`, hooks `useName.ts`, utils
  `camelCase.ts`, tests `ComponentName.test.tsx`, Playwright
  `feature-name.spec.ts`.
- Function components, explicit prop types, semantic HTML — no clickable
  `div`/`span`. Reuse shared components before creating new ones.
- Use configured path aliases; `import type` for type-only imports; no new
  barrel files.
- Keep transient UI state local; derive filtered/sorted data, don't store it.

## Evidence rules

Never guess or invent files, APIs, routes, types, fields, package names, or
behavior. Inspect relevant code first; the repository is the source of
truth; verify everything exists (dependencies in package.json); reuse
existing patterns.

- Low-risk, reversible detail → follow the closest existing pattern and
  report the decision.
- Ask first: new dependencies, public interfaces, architecture or
  data-shape changes, destructive operations, conflicting acceptance criteria.
- Brief plan first: multi-file changes, shared components or types, routing
  or config, accessibility or performance implications.

## Scope

Only implement what the current task requests. No refactoring, renaming, or
config changes outside the task; keep shared-component interfaces backward
compatible. If the task requires an out-of-scope change: stop, explain,
propose the smallest next step, wait for approval.

Never modify without approval: lockfiles, `.claude/`,
`src/data/mockLoads.json` (read-only data contract),
`docs/load-board-requirements.md` (input, not output).

When uncertain, choose the smallest reversible change and follow existing
patterns; for broader architectural decisions, present options instead of
guessing.

## Verification

none yet

## On session close

Before ending any session with a significant file or decision, append a
DEVLOG.md entry: date, files changed, decisions made, what's next, gotchas.

## Start a fresh conversation

After a discrete task; past ~40k tokens; before switching areas.
