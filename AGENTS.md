# Project Engineering Rules

This repository is a derived Lark Coding Agent Bridge integration. Preserve the
upstream license and make additive, reversible changes.

## Protected behavior

- Slash commands bypass semantic project routing.
- Ambiguous project requests never execute until the user selects a candidate.
- Cancellation never replays or queues the original task.
- Switching projects updates cwd before the original task continues and clears
  the old agent session.
- Project roots are explicit; never scan a drive or home directory by default.
- Feishu credentials, Codex auth, cc-connect tokens, cookies, and machine values
  must never be committed or logged.

## Verification

Run pnpm typecheck, pnpm test, and pnpm build after runtime changes. Do not claim
real Windows, service, cc-connect, or Feishu acceptance without evidence from
that environment. Keep Phase 2 disabled until its end-to-end contract is
implemented and tested.
