# Handoff

## Current endpoint

The implementation is locally reviewable on branch `codex/project-memory-mvp` at
commit `47f71cc765797e0615c8e25f899a9f1bc61f92d7`.
It is not deployed and does not claim real Feishu acceptance.

## Rollback

Use the timestamped backup under `.kv-fusion-backup/<STAMP>/src/bot/channel.ts`,
remove `src/project-memory/` and
`src/integration/lark-project-routing-hook.ts`, then rerun the upstream checks.
The backup directory is ignored and must not be committed.

## Next steps

1. Review the explicit staged file list and public security scan.
2. Commit and push `codex/project-memory-mvp`; create a Draft PR without merging.
3. Back up the real profile/task state outside the repository before any deployment action.
4. Run foreground acceptance and have the user perform the phone Feishu test matrix.
5. Only after Phase 1 evidence decide whether to implement Phase 2.
