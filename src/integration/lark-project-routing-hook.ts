import type { ProjectRoutingController } from '../project-memory/controller';
import { projectLabel } from '../project-memory/controller';

export interface BridgeMessageLike {
  chatId: string;
  messageId: string;
  content: string;
  senderId?: string;
  threadId?: string;
}

export interface WorkspaceStoreLike {
  cwdFor(scope: string): string | undefined;
  setCwd(scope: string, cwd: string): void;
}

export interface SessionStoreLike {
  clear(scope: string): void;
}

export interface ChannelLike {
  send(
    chatId: string,
    body: { markdown: string },
    options?: { replyTo?: string; replyInThread?: true },
  ): Promise<unknown>;
}

export interface ProjectRoutingHookInput<TMessage extends BridgeMessageLike = BridgeMessageLike> {
  controller?: ProjectRoutingController;
  scope: string;
  message: TMessage;
  chatMode: 'p2p' | 'group' | 'topic';
  workspaces: WorkspaceStoreLike;
  sessions: SessionStoreLike;
  channel: ChannelLike;
  recentPaths?: string[];
}

export type ProjectRoutingHookResult<TMessage extends BridgeMessageLike = BridgeMessageLike> =
  | { kind: 'continue'; message: TMessage; cwd?: string; switched: boolean }
  | { kind: 'handled' };

/**
 * Run before the bridge dispatches a normal message to the agent.
 * Slash commands are left to the upstream command router. Ambiguous project
 * references are answered by the bridge itself; confirmed/automatic matches
 * update cwd and clear the old agent session before replaying the original task.
 */
export async function applyProjectRouting<TMessage extends BridgeMessageLike>(
  input: ProjectRoutingHookInput<TMessage>,
): Promise<ProjectRoutingHookResult<TMessage>> {
  if (!input.controller || input.message.content.trim().startsWith('/')) {
    return {
      kind: 'continue',
      message: input.message,
      cwd: input.workspaces.cwdFor(input.scope),
      switched: false,
    };
  }

  const currentPath = input.workspaces.cwdFor(input.scope);
  const decision = await input.controller.handle(input.scope, input.message.content, {
    currentPath,
    recentPaths: input.recentPaths,
  });

  if (decision.kind === 'ask' || decision.kind === 'cancel') {
    await input.channel.send(
      input.message.chatId,
      { markdown: decision.markdown },
      replyOptions(input.message, input.chatMode),
    );
    return { kind: 'handled' };
  }

  if (decision.kind === 'route') {
    if (decision.changed) {
      input.workspaces.setCwd(input.scope, decision.cwd);
      input.sessions.clear(input.scope);
      await input.channel.send(
        input.message.chatId,
        {
          markdown: [
            `已定位：**${projectLabel(decision.project)}**`,
            `工作目录：\`${decision.cwd}\``,
            '已为该项目切换到独立会话。',
          ].join('\n'),
        },
        replyOptions(input.message, input.chatMode),
      );
    }
    return {
      kind: 'continue',
      message: withContent(input.message, decision.prompt),
      cwd: decision.cwd,
      switched: decision.changed,
    };
  }

  return {
    kind: 'continue',
    message: withContent(input.message, decision.prompt),
    cwd: decision.cwd,
    switched: false,
  };
}

function withContent<TMessage extends BridgeMessageLike>(message: TMessage, content: string): TMessage {
  return { ...message, content } as TMessage;
}

function replyOptions(
  message: BridgeMessageLike,
  chatMode: 'p2p' | 'group' | 'topic',
): { replyTo: string; replyInThread?: true } {
  return {
    replyTo: message.messageId,
    ...(chatMode === 'topic' && message.threadId ? { replyInThread: true as const } : {}),
  };
}
