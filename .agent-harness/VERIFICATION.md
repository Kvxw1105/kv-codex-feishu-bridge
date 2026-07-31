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
| `pnpm build` | exit 0 |
| Full target `pnpm test` | 633 pass / 6 fail |
| Clean upstream full `pnpm test` | 616 pass / 6 fail, same 2 files |

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

- Target profile foreground startup with a backup of real configuration.
- Windows service/task migration and single-consumer check.
- Phone Feishu tests for automatic routing, ambiguity, selection, cancellation, alias persistence, `/status`, and safe write fixture.
- CI and Draft PR review.
