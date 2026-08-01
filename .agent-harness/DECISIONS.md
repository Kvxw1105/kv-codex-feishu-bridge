# Decisions

## 2026-08-01

- Kept the upstream Codex CLI execution path as the Phase 1 backend.
- Added semantic project routing before the existing pending queue, with slash-command bypass and resolver failure pass-through.
- Kept the integration additive and reversible; the apply script validates package name and unique anchors and preserves line endings.
- Treated the six full-suite failures as baseline/environment failures only after reproducing them in a clean upstream worktree.
- Did not modify the global install, active cc-connect process, Windows task, or user credential stores.
