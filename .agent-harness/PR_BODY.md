## Implemented

- Add semantic project memory scanning, ranking, aliases, and persistence.
- Route normal Feishu messages before the existing queue.
- Return candidate choices for ambiguity and preserve cancellation safety.
- Switch workspace cwd and clear the old session before replaying the original prompt.
- Preserve slash commands and topic reply routing.
- Add a line-ending-safe, anchor-validated integration script and rollback backup.
- Preserve `--skip-check-lark-cli` through foreground and OS-service startup so a deliberately skipped preflight is not reintroduced by `Supervisor`.

## Local verification

- Bundle tests: 18/18 pass.
- Focused project-memory tests: 17/17 pass.
- Focused service-profile tests: 11/11 pass after startup fix commit `5bf49e9`.
- `pnpm typecheck`: pass.
- `pnpm build`: pass.
- Full target suite: 633 pass / 6 baseline failures.
- Clean upstream baseline at the same commit: 616 pass / 6 failures in the same two test files; the branch adds 17 passing routing tests.
- Foreground runtime: registry/lock metadata match one live `codex` profile process; the current JSONL log records `ws connected`, `profile-online`, `chats-fetched`, and `reconnected`.

## Not yet verified

- Real Windows profile startup or service migration.
- Real phone Feishu round trip.
- Real cc-connect Bridge WebSocket integration.
- CI result.
- OS-managed service registration and release.

## Safety and rollback

- No credentials, tokens, cookies, profile state, or real project inventory are committed.
- Phase 2 is not enabled and does not replace the Codex CLI backend.
- Restore the timestamped `.kv-fusion-backup` channel file and remove the two added runtime paths to roll back.
