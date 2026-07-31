# Handoff

## Current endpoint

The implementation is locally reviewable on branch `codex/project-memory-mvp`.
The functional startup fix is commit `5bf49e9`; the follow-up handoff commit
contains the runtime evidence and verification updates below. The current
foreground profile was observed online from the built CLI with
`run --profile codex --skip-check-lark-cli`, and its JSONL log recorded
`ws connected`, `profile-online`, `chats-fetched`, and `reconnected`.
It is not registered as this repository's OS-managed service, not released, and
does not claim phone Feishu acceptance. A pre-existing cc-connect helper logon
task remains outside this branch and was not modified.

## Rollback

Use the timestamped backup under `.kv-fusion-backup/<STAMP>/src/bot/channel.ts`,
remove `src/project-memory/` and
`src/integration/lark-project-routing-hook.ts`, then rerun the upstream checks.
The backup directory is ignored and must not be committed.

## Next steps

1. Push `codex/project-memory-mvp` and update Draft PR #1 with this handoff evidence.
2. Back up the real profile/task state outside the repository before any service migration action.
3. Have the user perform the phone Feishu matrix: read-only routing, ambiguity selection, cancellation, `/status`, alias persistence after restart, and the safe-write fixture.
4. Register an OS-managed service only after the foreground and phone checks pass; verify one consumer and rollback evidence.
5. Only after Phase 1 evidence decide whether to implement Phase 2.
