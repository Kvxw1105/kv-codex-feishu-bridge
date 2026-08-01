import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { ProjectRecord } from './types';
import { contentIdentityKey, projectIdentityKey } from './identity';
import { normalizeText, tokenize } from './tokenize';

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
];

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'AppData',
  '$Recycle.Bin',
]);

const README_NAMES = ['README.md', 'README.zh.md', 'README.zh-CN.md', 'readme.md'];
const INSTRUCTION_NAMES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];

export interface ScanOptions {
  maxDepth?: number;
  maxProjects?: number;
  maxTextChars?: number;
}

export async function scanProjectRoots(
  roots: readonly string[],
  options: ScanOptions = {},
): Promise<ProjectRecord[]> {
  const maxDepth = options.maxDepth ?? 3;
  const maxProjects = options.maxProjects ?? 300;
  const maxTextChars = options.maxTextChars ?? 8_000;
  const found = new Map<string, ProjectRecord>();

  for (const rootInput of roots) {
    if (found.size >= maxProjects) break;
    const root = resolve(rootInput);
    await visit(root, 0);
  }

  return collapseProjects([...found.values()]);

  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || found.size >= maxProjects) return;
    if (SKIP_DIRS.has(basename(dir))) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const names = new Set(entries.map((entry) => entry.name));
    const markers = PROJECT_MARKERS.filter((marker) => names.has(marker));
    if (markers.length > 0 && !isUnsafeProjectRoot(dir)) {
      const project = await buildProjectRecord(dir, markers, maxTextChars);
      found.set(normalizePathKey(project.path), project);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      await visit(join(dir, entry.name), depth + 1);
    }
  }
}

async function buildProjectRecord(
  projectPath: string,
  markers: string[],
  maxTextChars: number,
): Promise<ProjectRecord> {
  const packageJson = await readJsonFile(join(projectPath, 'package.json'));
  const packageName = stringValue(packageJson?.name);
  const packageDescription = stringValue(packageJson?.description);
  const readme = await readFirstExisting(projectPath, README_NAMES, maxTextChars);
  const instructions = await readFirstExisting(projectPath, INSTRUCTION_NAMES, 3_000);
  const directoryName = basename(projectPath);
  const name = packageName || inferTitle(readme) || directoryName;
  const description = [packageDescription, firstMeaningfulParagraph(readme), firstMeaningfulParagraph(instructions)]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 1_200);
  const sourceText = [name, directoryName, description, readme, instructions].join('\n');
  const keywords = rankKeywords(sourceText, 80);
  const aliases = unique([
    name,
    directoryName,
    normalizeText(name).replace(/[-_]+/g, ' '),
  ]).filter((value) => value.length >= 2);
  const lastActiveAt = await detectLastActiveAt(projectPath);
  const updatedAt = Date.now();
  const repositoryIdentity = await detectRepositoryIdentity(projectPath);

  return {
    id: createHash('sha256').update(normalizePathKey(projectPath)).digest('hex').slice(0, 16),
    identityKey: repositoryIdentity
      ? `repository:${repositoryIdentity}`
      : contentIdentityKey(name, description),
    name,
    path: resolve(projectPath),
    description,
    aliases,
    keywords,
    markers,
    lastActiveAt,
    updatedAt,
  };
}

function collapseProjects(projects: readonly ProjectRecord[]): ProjectRecord[] {
  const groups = new Map<string, ProjectRecord>();
  for (const project of [...projects].sort((a, b) => b.lastActiveAt - a.lastActiveAt)) {
    const key = projectIdentityKey(project);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, project);
      continue;
    }

    const preferred = project.lastActiveAt > existing.lastActiveAt ? project : existing;
    const other = preferred === project ? existing : project;
    groups.set(key, {
      ...preferred,
      aliases: unique([...preferred.aliases, ...other.aliases]),
      lastActiveAt: Math.max(preferred.lastActiveAt, other.lastActiveAt),
      updatedAt: Math.max(preferred.updatedAt, other.updatedAt),
    });
  }
  return [...groups.values()].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

async function detectRepositoryIdentity(projectPath: string): Promise<string | undefined> {
  const gitPath = join(projectPath, '.git');
  let gitDir = gitPath;
  try {
    const marker = await readFile(gitPath, 'utf8');
    const match = marker.match(/^\s*gitdir:\s*(.+?)\s*$/im);
    if (match?.[1]) gitDir = resolve(projectPath, match[1]);
  } catch {
    // A normal checkout has a .git directory, which is not readable as text.
  }

  const configPaths = [join(gitDir, 'config')];
  try {
    const commonDir = (await readFile(join(gitDir, 'commondir'), 'utf8')).trim();
    if (commonDir) configPaths.unshift(join(resolve(gitDir, commonDir), 'config'));
  } catch {
    // Ordinary repositories do not have a commondir file.
  }
  if (normalizePathKey(gitDir).includes('/.git/worktrees/')) {
    configPaths.unshift(join(dirname(dirname(gitDir)), 'config'));
  }

  for (const configPath of unique(configPaths)) {
    try {
      const config = await readFile(configPath, 'utf8');
      const remote = config.match(/^\s*url\s*=\s*(\S+)\s*$/im)?.[1];
      if (remote) return normalizeRemote(remote);
    } catch {
      // Continue through alternate worktree/common git config paths.
    }
  }
  return undefined;
}

function normalizeRemote(remote: string): string {
  return remote
    .trim()
    .toLowerCase()
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

function rankKeywords(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text.slice(0, 18_000))) {
    if (token.length < 2 || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

async function detectLastActiveAt(projectPath: string): Promise<number> {
  const candidates = [
    join(projectPath, '.git', 'index'),
    join(projectPath, '.git', 'HEAD'),
    join(projectPath, 'package.json'),
    projectPath,
  ];
  let latest = 0;
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      latest = Math.max(latest, info.mtimeMs);
    } catch {
      // Missing optional signal.
    }
  }
  return latest || Date.now();
}

async function readFirstExisting(
  projectPath: string,
  names: readonly string[],
  maxChars: number,
): Promise<string> {
  for (const name of names) {
    try {
      const value = await readFile(join(projectPath, name), 'utf8');
      return value.slice(0, maxChars);
    } catch {
      // Continue to the next known filename.
    }
  }
  return '';
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function inferTitle(readme: string): string | undefined {
  const match = readme.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim().slice(0, 100);
}

function firstMeaningfulParagraph(text: string): string {
  for (const block of text.split(/\n\s*\n/)) {
    const cleaned = block
      .replace(/^#+\s*/gm, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[[^\]]+\]\([^\)]+\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 20) return cleaned.slice(0, 500);
  }
  return '';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizePathKey(path: string): string {
  return resolve(path).replace(/\\/g, '/').toLowerCase();
}

function isUnsafeProjectRoot(path: string): boolean {
  const normalized = normalizePathKey(path);
  return (
    normalized === '/' ||
    /^[a-z]:\/?$/i.test(normalized) ||
    /\/(windows|program files|program files \(x86\)|users|home|tmp|temp)$/i.test(normalized)
  );
}
