import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'vitest';
import { scanProjectRoots } from '../../../src/project-memory/scanner.js';

async function makeProject(
  root: string,
  directory: string,
  name: string,
  description: string,
  readme: string,
): Promise<string> {
  const path = join(root, directory);
  await mkdir(join(path, '.git'), { recursive: true });
  await writeFile(join(path, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await writeFile(join(path, 'package.json'), JSON.stringify({ name, description }, null, 2));
  await writeFile(join(path, 'README.md'), readme);
  return path;
}

test('scans only configured roots and extracts searchable identity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-memory-scan-'));
  await makeProject(
    root,
    'nodus',
    'Sample Notes',
    '笔记与知识管理软件',
    '# Sample Notes\n\n包含星图、关系图、段落引用和移动端。',
  );

  const projects = await scanProjectRoots([root]);
  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.name, 'Sample Notes');
  assert.match(projects[0]?.description ?? '', /笔记与知识管理/);
  assert.ok(projects[0]?.keywords.some((token) => token.includes('星图')));
  assert.ok(projects[0]?.markers.includes('.git'));
});

test('does not walk dependency directories as projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-memory-skip-'));
  await makeProject(root, 'real-project', 'real-project', 'real project', '# Real\n\nReal project.');
  const fake = join(root, 'node_modules', 'fake-package');
  await mkdir(join(fake, '.git'), { recursive: true });
  await writeFile(join(fake, 'package.json'), JSON.stringify({ name: 'fake-package' }));

  const projects = await scanProjectRoots([root]);
  assert.deepEqual(projects.map((entry) => entry.name), ['real-project']);
});

test('respects an explicit project limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-memory-limit-'));
  await makeProject(root, 'first', 'first', 'first project', '# First\n\nFirst project.');
  await makeProject(root, 'second', 'second', 'second project', '# Second\n\nSecond project.');

  const projects = await scanProjectRoots([root], { maxProjects: 1 });
  assert.equal(projects.length, 1);
});
