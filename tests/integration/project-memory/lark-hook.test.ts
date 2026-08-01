import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'vitest';
import { ProjectRoutingController } from '../../../src/project-memory/controller.js';
import { ProjectResolver } from '../../../src/project-memory/resolver.js';
import { ProjectMemoryStore } from '../../../src/project-memory/store.js';
import {
  applyProjectRouting,
  type BridgeMessageLike,
} from '../../../src/integration/lark-project-routing-hook.js';
import { NOW, SAMPLE_PROJECTS } from '../../unit/project-memory/fixtures.js';

interface TestMessage extends BridgeMessageLike {
  rawMarker: string;
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'project-memory-hook-'));
  const store = new ProjectMemoryStore(join(root, 'memory.json'));
  store.replaceProjects(SAMPLE_PROJECTS);
  await store.save();
  const controller = new ProjectRoutingController(
    new ProjectResolver(() => store.list(), {
      autoThreshold: 40,
      confirmThreshold: 18,
      autoMargin: 12,
    }),
    store,
  );
  const cwd = new Map<string, string>();
  const cleared: string[] = [];
  const sent: Array<{ chatId: string; markdown: string; replyTo?: string; replyInThread?: true }> = [];
  return {
    controller,
    cwd,
    cleared,
    sent,
    workspaces: {
      cwdFor: (scope: string) => cwd.get(scope),
      setCwd: (scope: string, path: string) => void cwd.set(scope, path),
    },
    sessions: { clear: (scope: string) => void cleared.push(scope) },
    channel: {
      async send(
        chatId: string,
        body: { markdown: string },
        options?: { replyTo?: string; replyInThread?: true },
      ) {
        sent.push({ chatId, markdown: body.markdown, ...options });
      },
    },
  };
}

function message(content: string, messageId = 'message-1'): TestMessage {
  return { chatId: 'chat-1', messageId, content, rawMarker: 'preserved' };
}

test('auto routing updates cwd, clears session, and preserves message fields', async () => {
  const env = await setup();
  const scope = 'chat-1';
  env.cwd.set(scope, 'D:\\fixture-workspaces\\kv-archive');

  const result = await applyProjectRouting({
    controller: env.controller,
    scope,
    message: message('看看那个笔记软件，继续改星图'),
    chatMode: 'p2p',
    workspaces: env.workspaces,
    sessions: env.sessions,
    channel: env.channel,
  });

  assert.equal(result.kind, 'continue');
  if (result.kind === 'continue') {
    assert.equal(result.cwd, 'D:\\fixture-workspaces\\nodus');
    assert.equal(result.switched, true);
    assert.equal(result.message.content, '看看那个笔记软件，继续改星图');
    assert.equal(result.message.rawMarker, 'preserved');
  }
  assert.deepEqual(env.cleared, [scope]);
  assert.equal(env.sent.length, 1);
  assert.match(env.sent[0]?.markdown ?? '', /已定位/);
});

test('ambiguous topic routing asks once and does not run the agent', async () => {
  const env = await setup();
  const result = await applyProjectRouting({
    controller: env.controller,
    scope: 'chat-1:thread-9',
    message: { ...message('看看那个 bridge 最近还有什么问题', 'message-2'), threadId: 'thread-9' },
    chatMode: 'topic',
    workspaces: env.workspaces,
    sessions: env.sessions,
    channel: env.channel,
  });

  assert.deepEqual(result, { kind: 'handled' });
  assert.equal(env.sent.length, 1);
  assert.equal(env.sent[0]?.replyInThread, true);
  assert.match(env.sent[0]?.markdown ?? '', /回复数字即可/);
  assert.deepEqual(env.cleared, []);
});

test('slash commands bypass project memory', async () => {
  const env = await setup();
  env.cwd.set('chat-1', 'D:\\fixture-workspaces\\nodus');
  const result = await applyProjectRouting({
    controller: env.controller,
    scope: 'chat-1',
    message: message('/status', 'message-3'),
    chatMode: 'p2p',
    workspaces: env.workspaces,
    sessions: env.sessions,
    channel: env.channel,
  });
  assert.equal(result.kind, 'continue');
  if (result.kind === 'continue') assert.equal(result.cwd, 'D:\\fixture-workspaces\\nodus');
  assert.equal(env.sent.length, 0);
});

test('cancelling an ambiguous choice does not queue or switch the original task', async () => {
  const env = await setup();
  const input = {
    controller: env.controller,
    scope: 'chat-1',
    chatMode: 'p2p' as const,
    workspaces: env.workspaces,
    sessions: env.sessions,
    channel: env.channel,
  };
  const first = await applyProjectRouting({
    ...input,
    message: message('看看那个 bridge 最近还有什么问题', 'message-4'),
  });
  assert.deepEqual(first, { kind: 'handled' });

  const second = await applyProjectRouting({
    ...input,
    message: message('取消', 'message-5'),
  });
  assert.deepEqual(second, { kind: 'handled' });
  assert.match(env.sent.at(-1)?.markdown ?? '', /原任务没有执行/);
  assert.deepEqual(env.cleared, []);
});
