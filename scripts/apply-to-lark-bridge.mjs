#!/usr/bin/env node
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetArg = args.find((arg) => !arg.startsWith('--'));
if (!targetArg) {
  console.error('Usage: node scripts/apply-to-lark-bridge.mjs <lark-bridge-root> [--dry-run]');
  process.exit(2);
}

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = resolve(targetArg);
const packagePath = join(targetRoot, 'package.json');
const channelPath = join(targetRoot, 'src', 'bot', 'channel.ts');

await assertFile(packagePath);
await assertFile(channelPath);
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
if (pkg.name !== 'lark-channel-bridge') {
  throw new Error(`target package must be lark-channel-bridge, got ${String(pkg.name)}`);
}

const original = await readFile(channelPath, 'utf8');
const newline = original.includes('\r\n') ? '\r\n' : '\n';
let channel = original.replace(/\r\n/g, '\n');

channel = replaceOnce(
  channel,
  "import type { WorkspaceStore } from '../workspace/store';",
  [
    "import type { WorkspaceStore } from '../workspace/store';",
    "import {",
    "  createProjectRoutingControllerFromEnv,",
    "  type ProjectRoutingController,",
    "} from '../project-memory';",
    "import { applyProjectRouting } from '../integration/lark-project-routing-hook';",
  ].join('\n'),
  'project routing imports',
);

channel = replaceOnce(
  channel,
  "  appPaths?: Pick<AppPaths, 'secretsFile' | 'keystoreSaltFile' | 'mediaDir'>;\n}",
  "  appPaths?: Pick<AppPaths, 'secretsFile' | 'keystoreSaltFile' | 'mediaDir'>;\n  projectRouting?: ProjectRoutingController;\n}",
  'StartChannelDeps projectRouting field',
);

channel = replaceOnce(
  channel,
  '  const { cfg, agent, sessions, sessionCatalog, workspaces, controls } = deps;\n  const activeRuns = new ActiveRuns();',
  [
    '  const { cfg, agent, sessions, sessionCatalog, workspaces, controls } = deps;',
    '  const projectRouting =',
    '    deps.projectRouting ?? (await createProjectRoutingControllerFromEnv());',
    '  const activeRuns = new ActiveRuns();',
  ].join('\n'),
  'project routing initialization',
);

channel = replaceOnce(
  channel,
  '          pool,\n        }),',
  '          pool,\n          projectRouting,\n        }),',
  'message intake dependency',
);

channel = replaceOnce(
  channel,
  '  pool: ProcessPool;\n}',
  '  pool: ProcessPool;\n  projectRouting?: ProjectRoutingController;\n}',
  'IntakeDeps projectRouting field',
);

channel = replaceOnce(
  channel,
  '    pool,\n  } = deps;',
  '    pool,\n    projectRouting,\n  } = deps;',
  'intake destructure',
);

channel = replaceOnce(
  channel,
  '  const emsg: NormalizedMessage = threadId === msg.threadId ? msg : { ...msg, threadId };',
  '  let emsg: NormalizedMessage = threadId === msg.threadId ? msg : { ...msg, threadId };',
  'mutable normalized message',
);

channel = replaceOnce(
  channel,
  "  if (handled) {\n    const dropped = pending.cancel(scope);\n    log.info('intake', 'command', { scope, droppedPending: dropped.length });\n    return;\n  }\n\n  const size = pending.push(scope, emsg);",
  [
    '  if (handled) {',
    '    const dropped = pending.cancel(scope);',
    "    log.info('intake', 'command', { scope, droppedPending: dropped.length });",
    '    return;',
    '  }',
    '',
    '  const projectRoute = await applyProjectRouting({',
    '    controller: projectRouting,',
    '    scope,',
    '    message: emsg,',
    '    chatMode,',
    '    workspaces,',
    '    sessions,',
    '    channel,',
    '    recentPaths: Object.values(workspaces.listCwds()).reverse(),',
    '  });',
    "  if (projectRoute.kind === 'handled') {",
    '    pending.cancel(scope);',
    '    return;',
    '  }',
    '  emsg = projectRoute.message;',
    '',
    '  const size = pending.push(scope, emsg);',
  ].join('\n'),
  'project route before queue',
);

const output = channel.replace(/\n/g, newline);
if (output === original) throw new Error('no changes produced');

const planned = [
  'src/project-memory/*',
  'src/integration/lark-project-routing-hook.ts',
  'src/bot/channel.ts',
];
console.log(`${dryRun ? 'DRY RUN' : 'APPLY'} target: ${targetRoot}`);
for (const item of planned) console.log(`- ${item}`);
if (dryRun) process.exit(0);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = join(targetRoot, '.kv-fusion-backup', stamp, 'src', 'bot');
await mkdir(backup, { recursive: true });
await writeFile(join(backup, 'channel.ts'), original, 'utf8');

await cp(join(bundleRoot, 'src', 'project-memory'), join(targetRoot, 'src', 'project-memory'), {
  recursive: true,
  force: false,
  errorOnExist: true,
});
await mkdir(join(targetRoot, 'src', 'integration'), { recursive: true });
await cp(
  join(bundleRoot, 'src', 'integration', 'lark-project-routing-hook.ts'),
  join(targetRoot, 'src', 'integration', 'lark-project-routing-hook.ts'),
  { force: false, errorOnExist: true },
);
await writeFile(channelPath, output, 'utf8');

console.log('Applied successfully.');
console.log(`Backup: ${join(targetRoot, '.kv-fusion-backup', stamp)}`);
console.log('Next: pnpm typecheck && pnpm test && pnpm build');

function replaceOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0) throw new Error(`anchor not found: ${label}`);
  if (text.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`anchor is not unique: ${label}`);
  }
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}

async function assertFile(path) {
  const info = await stat(path).catch(() => undefined);
  if (!info?.isFile()) throw new Error(`required file missing: ${path}`);
}
