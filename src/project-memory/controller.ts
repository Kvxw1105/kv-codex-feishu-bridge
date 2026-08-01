import type {
  PendingProjectChoice,
  ProjectRecord,
  RoutingDecision,
  ResolutionCandidate,
} from './types';
import { compactAlias, normalizeText } from './tokenize';
import { ProjectResolver } from './resolver';
import { ProjectMemoryStore } from './store';

const PENDING_TTL_MS = 10 * 60 * 1000;

export interface ControllerContext {
  currentPath?: string;
  recentPaths?: string[];
  now?: number;
}

export class ProjectRoutingController {
  private readonly pending = new Map<string, PendingProjectChoice>();
  private readonly resolver: ProjectResolver;
  private readonly store: ProjectMemoryStore;

  constructor(resolver: ProjectResolver, store: ProjectMemoryStore) {
    this.resolver = resolver;
    this.store = store;
  }

  async handle(
    scope: string,
    prompt: string,
    context: ControllerContext = {},
  ): Promise<RoutingDecision> {
    const now = context.now ?? Date.now();
    const pending = this.pending.get(scope);
    if (pending && now - pending.createdAt <= PENDING_TTL_MS) {
      const selected = selectPending(prompt, pending.candidates);
      if (selected) {
        this.pending.delete(scope);
        const alias = compactAlias(pending.originalPrompt);
        if (alias) this.store.addAlias(selected.project.path, alias);
        this.store.touch(selected.project.path, now);
        await this.store.save();
        return {
          kind: 'route',
          prompt: pending.originalPrompt,
          cwd: selected.project.path,
          project: selected.project,
          changed: !samePath(context.currentPath, selected.project.path),
          reason: 'user confirmed a project candidate',
        };
      }
      if (isCancel(prompt)) {
        this.pending.delete(scope);
        return {
          kind: 'cancel',
          markdown: '已取消项目切换，原任务没有执行。',
          reason: 'project selection cancelled',
        };
      }
    } else if (pending) {
      this.pending.delete(scope);
    }

    const resolution = this.resolver.resolve(prompt, context);
    if (resolution.kind === 'auto' || resolution.kind === 'current') {
      this.store.touch(resolution.project.path, now);
      await this.store.save();
      return {
        kind: 'route',
        prompt,
        cwd: resolution.project.path,
        project: resolution.project,
        changed: !samePath(context.currentPath, resolution.project.path),
        reason: resolution.reason,
      };
    }

    if (resolution.kind === 'confirm') {
      const candidates = resolution.candidates.slice(0, 3);
      this.pending.set(scope, {
        scope,
        originalPrompt: prompt,
        candidates,
        createdAt: now,
      });
      return {
        kind: 'ask',
        markdown: renderCandidatePrompt(candidates),
        candidates,
        reason: resolution.reason,
      };
    }

    return {
      kind: 'pass',
      prompt,
      cwd: context.currentPath,
      reason: resolution.reason,
    };
  }

  clear(scope: string): void {
    this.pending.delete(scope);
  }
}

export function renderCandidatePrompt(candidates: readonly ResolutionCandidate[]): string {
  const lines = [
    '我还不能完全确定你说的是哪个项目。回复数字即可，我会自动切换并继续原任务：',
    '',
  ];
  candidates.forEach((candidate, index) => {
    const summary = candidate.project.description || candidate.project.keywords.slice(0, 5).join('、');
    lines.push(
      `**${index + 1}. ${candidate.project.name}**`,
      summary ? summary.slice(0, 120) : candidate.project.path,
      `位置：\`${candidate.project.path}\``,
      '',
    );
  });
  lines.push('回复 `取消` 可留在当前项目。');
  return lines.join('\n');
}

function selectPending(
  reply: string,
  candidates: readonly ResolutionCandidate[],
): ResolutionCandidate | undefined {
  const normalized = normalizeText(reply);
  const numeric = normalized.match(/^(?:第)?\s*([1-9])\s*(?:个|项)?$/)?.[1];
  if (numeric) return candidates[Number(numeric) - 1];

  return candidates.find((candidate) =>
    [candidate.project.name, ...candidate.project.aliases].some((alias) => {
      const normalizedAlias = normalizeText(alias);
      return normalizedAlias.length >= 2 && normalized.includes(normalizedAlias);
    }),
  );
}

function isCancel(reply: string): boolean {
  return /^(取消|算了|不切换|留在当前|cancel)$/i.test(normalizeText(reply));
}

function samePath(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
}

export function projectLabel(project: ProjectRecord): string {
  const feature = project.keywords.slice(0, 3).join('、');
  return feature ? `${project.name} · ${feature}` : project.name;
}
