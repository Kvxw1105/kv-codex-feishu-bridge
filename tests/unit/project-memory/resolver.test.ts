import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ProjectResolver } from '../../../src/project-memory/resolver.js';
import { NOW, SAMPLE_PROJECTS } from './fixtures.js';

const resolver = new ProjectResolver(() => SAMPLE_PROJECTS, {
  autoThreshold: 40,
  confirmThreshold: 18,
  autoMargin: 12,
});

test('resolves a fuzzy note-app description to Sample Notes', () => {
  const result = resolver.resolve('看看那个笔记软件，继续改星图只显示一两个笔记的问题', {
    now: NOW,
  });
  assert.equal(result.kind, 'auto');
  if (result.kind === 'auto') assert.equal(result.project.name, 'Sample Notes');
});

test('resolves a feature-heavy video request to Sample Video', () => {
  const result = resolver.resolve('看看做剪映草稿的那个视频项目，字幕时间轴还是错位', {
    now: NOW,
  });
  assert.equal(result.kind, 'auto');
  if (result.kind === 'auto') assert.equal(result.project.name, 'Sample Video');
});

test('resolves a saved-conversation description to Sample Archive', () => {
  const result = resolver.resolve('那个保存对话的工具，导出文件名要跟对话名称一致', { now: NOW });
  assert.equal(result.kind, 'auto');
  if (result.kind === 'auto') assert.equal(result.project.name, 'Sample Archive');
});

test('keeps the current project for an ordinary follow-up with mixed Windows path syntax', () => {
  const result = resolver.resolve('接着刚才那个问题继续修，先别改数据库结构', {
    currentPath: 'd:/FIXTURE-WORKSPACES/nodus',
    now: NOW,
  });
  assert.equal(result.kind, 'current');
  if (result.kind === 'current') assert.equal(result.project.name, 'Sample Notes');
});

test('asks for confirmation when bridge wording is ambiguous', () => {
  const result = resolver.resolve('看看那个 bridge 最近还有什么问题', { now: NOW });
  assert.equal(result.kind, 'confirm');
  if (result.kind === 'confirm') {
    assert.ok(result.candidates.length >= 2);
    const names = result.candidates.map((candidate) => candidate.project.name);
    assert.ok(names.includes('Sample Browser Bridge'));
    assert.ok(names.includes('Sample Feishu Bridge'));
  }
});

test('keeps generic bridge wording confirmatory despite a dominant score', () => {
  const dominant = {
    ...SAMPLE_PROJECTS[4]!,
    name: 'lark-channel-bridge',
    aliases: ['lark-channel-bridge'],
    lastActiveAt: NOW,
  };
  const staleOther = {
    ...SAMPLE_PROJECTS[3]!,
    lastActiveAt: NOW - 7 * 24 * 60 * 60 * 1000,
  };
  const resolverWithDominantMatch = new ProjectResolver(() => [dominant, staleOther], {
    autoThreshold: 40,
    confirmThreshold: 18,
    autoMargin: 12,
  });

  const result = resolverWithDominantMatch.resolve('看看那个 bridge 最近还有什么问题', { now: NOW });
  assert.equal(result.kind, 'confirm');
  if (result.kind === 'confirm') {
    assert.equal(result.candidates[0]?.project.name, 'lark-channel-bridge');
    assert.equal(result.candidates.length, 2);
  }
});

test('does not let the current bridge project suppress generic disambiguation', () => {
  const result = resolver.resolve('看看那个 bridge 最近还有什么问题', {
    currentPath: SAMPLE_PROJECTS[4]!.path,
    now: NOW,
  });
  assert.equal(result.kind, 'confirm');
  if (result.kind === 'confirm') {
    assert.ok(result.candidates.length >= 2);
  }
});

test('deduplicates logical project copies before limiting candidates', () => {
  const duplicateA = { ...SAMPLE_PROJECTS[4]!, path: 'D:/copies/bridge-a', identityKey: 'repository:https://example.test/bridge' };
  const duplicateB = { ...SAMPLE_PROJECTS[4]!, path: 'D:/copies/bridge-b', identityKey: 'repository:https://example.test/bridge' };
  const resolverWithCopies = new ProjectResolver(() => [duplicateA, duplicateB, SAMPLE_PROJECTS[3]!, SAMPLE_PROJECTS[4]!], {
    autoThreshold: 40,
    confirmThreshold: 18,
    autoMargin: 12,
    maxCandidates: 3,
  });

  const result = resolverWithCopies.resolve('看看那个 bridge 最近还有什么问题', { now: NOW });
  assert.equal(result.kind, 'confirm');
  if (result.kind === 'confirm') {
    assert.equal(new Set(result.candidates.map((candidate) => projectIdentity(candidate))).size, result.candidates.length);
    assert.ok(result.candidates.some((candidate) => candidate.project.name === 'Sample Browser Bridge'));
  }
});

test('slash commands never trigger a project switch', () => {
  const result = resolver.resolve('/status', {
    currentPath: `${FIXTURE_ROOT_FOR_TEST}/video-forge`,
    now: NOW,
  });
  assert.equal(result.kind, 'current');
  if (result.kind === 'current') assert.equal(result.project.name, 'Sample Video');
});

const FIXTURE_ROOT_FOR_TEST = 'D:/fixture-workspaces';

function projectIdentity(candidate: { project: { identityKey?: string; name: string; description: string } }): string {
  return candidate.project.identityKey ?? `${candidate.project.name}:${candidate.project.description}`;
}
