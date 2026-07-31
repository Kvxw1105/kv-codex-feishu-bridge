# Verification

## Commands

| Command | Result |
| --- | --- |
| Bundle `npm install` | exit 0 |
| Bundle `npm test` | 18/18 pass |
| Bundle `npm run ci` | exit 0 |
| Apply script dry-run | exit 0 after CRLF and upstream blank-line compatibility fixes |
| Apply script apply | exit 0; backup created |
| Disposable applied worktree typecheck | exit 0 |
| `pnpm install --frozen-lockfile` | exit 0 after low-concurrency retry; lockfile unchanged |
| `pnpm typecheck` | exit 0 |
| Focused project-memory Vitest | 17/17 pass |
| Focused service-profile Vitest | 11/11 pass after `--skip-check-lark-cli` startup fix |
| `pnpm build` | exit 0 |
| Full target `pnpm test` | 633 pass / 6 fail |
| Clean upstream full `pnpm test` | 616 pass / 6 fail, same 2 files |
| `git diff --check` and public-tree secret scan | exit 0; `gitleaks` unavailable, fallback scan found only examples, field names, and fixtures |

## Runtime evidence

- Foreground process command line includes `dist/cli.js run --profile codex --skip-check-lark-cli`.
- The registry entry and profile/app runtime-lock metadata agree on the active profile and process; no second consumer was observed.
- The current profile JSONL log records `ws connected`, `profile-online`, `chats-fetched`, and `reconnected` after startup.
- The process is not registered as an OS-managed service/task. This is foreground runtime evidence, not service migration or release evidence.

## Focused coverage

- High-confidence note/video/archive routing.
- Current-project follow-up with mixed Windows path syntax.
- Ambiguous candidates and numeric confirmation.
- Cancellation without alias or task execution.
- Alias persistence.
- cwd switch and session clear.
- Slash command bypass.
- Topic reply threading.
- Explicit scan roots, dependency-directory exclusion, and project limit.

## Remaining acceptance

- Target profile foreground startup with a backup of real configuration has been observed; repeatable phone confirmation is still pending.
- Windows service/task migration and single-consumer check.
- Phone Feishu tests for automatic routing, ambiguity, selection, cancellation, alias persistence, `/status`, and safe write fixture.
- CI and Draft PR review.
