## Done means

`npm run check` passes: it runs what CI runs (typecheck plus tests with coverage floors). `npm test` alone skips the coverage floors.

## Comparing against main

Diff, review and branch from `origin/main` after `git fetch`. Local `main` is not kept current, so it can trail already-merged PRs.

## Worktrees

A fresh worktree has no `node_modules`, so `npm run check` and pushes fail there. Link it first: see DEVELOPMENT.md, Worktrees.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (arieend/RecieptManager) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
