import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'vitest';
import { ProjectRoutingController } from '../../../src/project-memory/controller.js';
import { ProjectResolver } from '../../../src/project-memory/resolver.js';
import { ProjectMemoryStore } from '../../../src/project-memory/store.js';
import { NOW, SAMPLE_PROJECTS } from './fixtures.js';

async function createController(): Promise<{
  controller: ProjectRoutingController;
  storePath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'project-memory-controller-'));
  const storePath = join(root, 'project-memory.json');
  const store = new ProjectMemoryStore(storePath, ['D:\\fixture-workspaces']);
  store.replaceProjects(SAMPLE_PROJECTS);
  await store.save();
  const resolver = new ProjectResolver(() => store.list(), {
    autoThreshold: 40,
    confirmThreshold: 18,
    autoMargin: 12,
  });
  return { controller: new ProjectRoutingController(resolver, store), storePath };
}

test('numeric confirmation routes and replays the original task', async () => {
  const { controller } = await createController();
  const first = await controller.handle('dm:owner', '看看那个 bridge 最近还有什么问题', { now: NOW });
  assert.equal(first.kind, 'ask');
  if (first.kind !== 'ask') return;

  const targetIndex = first.candidates.findIndex(
    (candidate) => candidate.project.name === 'Sample Feishu Bridge',
  );
  assert.ok(targetIndex >= 0);

  const second = await controller.handle('dm:owner', String(targetIndex + 1), { now: NOW + 1_000 });
  assert.equal(second.kind, 'route');
  if (second.kind === 'route') {
    assert.equal(second.project.name, 'Sample Feishu Bridge');
    assert.equal(second.prompt, '看看那个 bridge 最近还有什么问题');
    assert.equal(second.changed, true);
  }
});

test('confirmation learns the original fuzzy phrase as a local alias', async () => {
  const { controller, storePath } = await createController();
  const first = await controller.handle('dm:owner', '看看那个 bridge 最近还有什么问题', { now: NOW });
  assert.equal(first.kind, 'ask');
  if (first.kind !== 'ask') return;
  const targetIndex = first.candidates.findIndex(
    (candidate) => candidate.project.name === 'Sample Browser Bridge',
  );
  assert.ok(targetIndex >= 0);

  await controller.handle('dm:owner', String(targetIndex + 1), { now: NOW + 1_000 });
  const stored = JSON.parse(await readFile(storePath, 'utf8')) as {
    projects: Array<{ name: string; aliases: string[] }>;
  };
  const project = stored.projects.find((entry) => entry.name === 'Sample Browser Bridge');
  assert.ok(project?.aliases.includes('看看那个 bridge 最近还有什么问题'));
});

test('cancel stops an ambiguous task without executing or changing aliases', async () => {
  const { controller, storePath } = await createController();
  const first = await controller.handle('dm:owner', '看看那个 bridge 最近还有什么问题', { now: NOW });
  assert.equal(first.kind, 'ask');

  const second = await controller.handle('dm:owner', '取消', {
    currentPath: 'D:\\fixture-workspaces\\nodus',
    now: NOW + 2_000,
  });
  assert.equal(second.kind, 'cancel');
  if (second.kind === 'cancel') assert.match(second.markdown, /原任务没有执行/);

  const stored = JSON.parse(await readFile(storePath, 'utf8')) as {
    projects: Array<{ aliases: string[] }>;
  };
  assert.ok(!stored.projects.some((project) => project.aliases.includes('看看那个 bridge 最近还有什么问题')));
});

test('passes through an unknown project request without selecting a workspace', async () => {
  const { controller } = await createController();
  const result = await controller.handle('dm:owner', '请查找一个不存在的实验项目', { now: NOW });
  assert.equal(result.kind, 'pass');
  if (result.kind === 'pass') assert.equal(result.cwd, undefined);
});
