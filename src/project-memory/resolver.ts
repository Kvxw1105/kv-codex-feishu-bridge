import type {
  ProjectRecord,
  ProjectResolution,
  ResolutionCandidate,
  ResolutionContext,
} from './types';
import { projectIdentityKey } from './identity';
import { normalizeText, overlapCount, tokenize } from './tokenize';

const PROJECT_REFERENCE = /(那个|这个|上次|之前|昨天|前天|前几天|最近|刚才|项目|软件|工具|网站|应用|系统|仓库|bridge|助手|做.+的)/i;
const FOLLOW_UP = /(继续|接着|刚才|上次|昨天|之前|那个|这个|再看|再改|继续做)/i;
const SWITCH_SIGNAL = /(切到|换到|再看看|另外|另一个|那个.+项目|那个.+软件|那个.+工具|做.+的)/i;

export interface ResolverOptions {
  autoThreshold?: number;
  confirmThreshold?: number;
  autoMargin?: number;
  maxCandidates?: number;
}

export class ProjectResolver {
  private readonly projects: () => ProjectRecord[];
  private readonly autoThreshold: number;
  private readonly confirmThreshold: number;
  private readonly autoMargin: number;
  private readonly maxCandidates: number;

  constructor(projects: () => ProjectRecord[], options: ResolverOptions = {}) {
    this.projects = projects;
    this.autoThreshold = options.autoThreshold ?? 45;
    this.confirmThreshold = options.confirmThreshold ?? 20;
    this.autoMargin = options.autoMargin ?? 15;
    this.maxCandidates = options.maxCandidates ?? 3;
  }

  resolve(query: string, context: ResolutionContext = {}): ProjectResolution {
    const projects = this.projects();
    if (projects.length === 0) {
      return { kind: 'none', candidates: [], reason: 'project index is empty' };
    }

    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const current = context.currentPath
      ? projects.find((project) => samePath(project.path, context.currentPath!))
      : undefined;

    if (!normalizedQuery || query.trim().startsWith('/')) {
      if (current) {
        return { kind: 'current', project: current, candidates: [], reason: 'command or empty input keeps current project' };
      }
      return { kind: 'none', candidates: [], reason: 'command or empty input has no project signal' };
    }

    const hasReference = PROJECT_REFERENCE.test(normalizedQuery);
    const hasExplicitAlias = projects.some((project) =>
      project.aliases.some((alias) => aliasMatches(normalizedQuery, alias)),
    );
    const hasGenericBridgeReference = queryTokens.includes('bridge') && !hasExplicitAlias;
    const likelySwitch = SWITCH_SIGNAL.test(normalizedQuery) || hasExplicitAlias;

    if (current && FOLLOW_UP.test(normalizedQuery) && !likelySwitch && !hasGenericBridgeReference) {
      return {
        kind: 'current',
        project: current,
        candidates: [],
        reason: 'follow-up language keeps the current project',
      };
    }

    const candidates = dedupeCandidates(
      projects
        .map((project) => scoreProject(project, normalizedQuery, queryTokens, context))
        .filter((candidate) => candidate.score > 0),
    )
      .sort((a, b) => b.score - a.score || b.project.lastActiveAt - a.project.lastActiveAt)
      .slice(0, this.maxCandidates);

    if (candidates.length === 0) {
      if (current) {
        return {
          kind: 'current',
          project: current,
          candidates: [],
          reason: 'no project evidence; keep current project',
        };
      }
      return { kind: 'none', candidates: [], reason: 'no matching project evidence' };
    }

    const top = candidates[0]!;
    const second = candidates[1];
    const margin = second ? top.score - second.score : top.score;

    if (!hasReference && !hasExplicitAlias && current) {
      return {
        kind: 'current',
        project: current,
        candidates,
        reason: 'message looks task-focused rather than project-switching',
      };
    }

    if (hasGenericBridgeReference && candidates.length > 1) {
      return {
        kind: 'confirm',
        candidates,
        reason: `generic bridge wording has multiple logical matches (${top.score}, margin ${margin})`,
      };
    }

    if (top.score >= this.autoThreshold && margin >= this.autoMargin) {
      if (current && samePath(current.path, top.project.path)) {
        return {
          kind: 'current',
          project: current,
          candidates,
          reason: `current project is the strongest semantic match (${top.score})`,
        };
      }
      return {
        kind: 'auto',
        project: top.project,
        candidates,
        reason: `strong semantic match (${top.score}, margin ${margin})`,
      };
    }

    if (top.score >= this.confirmThreshold && (hasReference || hasExplicitAlias)) {
      return {
        kind: 'confirm',
        candidates,
        reason: `multiple plausible projects (${top.score}, margin ${margin})`,
      };
    }

    if (current) {
      return {
        kind: 'current',
        project: current,
        candidates,
        reason: 'evidence is too weak to switch projects',
      };
    }

    return { kind: 'none', candidates, reason: 'evidence is below confirmation threshold' };
  }
}

function dedupeCandidates(candidates: readonly ResolutionCandidate[]): ResolutionCandidate[] {
  const unique = new Map<string, ResolutionCandidate>();
  for (const candidate of candidates) {
    const key = projectIdentityKey(candidate.project);
    const existing = unique.get(key);
    if (!existing || candidate.score > existing.score || candidate.project.lastActiveAt > existing.project.lastActiveAt) {
      unique.set(key, candidate);
    }
  }
  return [...unique.values()];
}

function scoreProject(
  project: ProjectRecord,
  normalizedQuery: string,
  queryTokens: readonly string[],
  context: ResolutionContext,
): ResolutionCandidate {
  let score = 0;
  const reasons: string[] = [];
  const nameTokens = tokenize(project.name);
  const aliasTokens = project.aliases.flatMap(tokenize);
  const keywordTokens = project.keywords;
  const descriptionTokens = tokenize(project.description);

  for (const alias of project.aliases) {
    if (aliasMatches(normalizedQuery, alias)) {
      score += 100;
      reasons.push(`alias: ${alias}`);
      break;
    }
  }

  const nameOverlap = overlapCount(queryTokens, nameTokens);
  if (nameOverlap > 0) {
    score += nameOverlap * 24;
    reasons.push(`name tokens: ${nameOverlap}`);
  }

  const aliasOverlap = overlapCount(queryTokens, aliasTokens);
  if (aliasOverlap > 0) {
    score += aliasOverlap * 14;
    reasons.push(`alias tokens: ${aliasOverlap}`);
  }

  const keywordOverlap = overlapCount(queryTokens, keywordTokens);
  if (keywordOverlap > 0) {
    score += keywordOverlap * 9;
    reasons.push(`feature tokens: ${keywordOverlap}`);
  }

  const descriptionOverlap = overlapCount(queryTokens, descriptionTokens);
  if (descriptionOverlap > 0) {
    score += descriptionOverlap * 5;
    reasons.push(`description tokens: ${descriptionOverlap}`);
  }

  const recentIndex = (context.recentPaths ?? []).findIndex((path) => samePath(path, project.path));
  if (recentIndex >= 0) {
    const recentBonus = Math.max(2, 12 - recentIndex * 3);
    score += recentBonus;
    reasons.push(`recent project: +${recentBonus}`);
  }

  const now = context.now ?? Date.now();
  const ageHours = Math.max(0, (now - project.lastActiveAt) / 3_600_000);
  const activityBonus = ageHours <= 24 ? 8 : ageHours <= 168 ? 5 : ageHours <= 720 ? 2 : 0;
  if (activityBonus > 0) {
    score += activityBonus;
    reasons.push(`recent activity: +${activityBonus}`);
  }

  if (context.currentPath && samePath(context.currentPath, project.path)) {
    score += 6;
    reasons.push('current project: +6');
  }

  return { project, score, reasons };
}

function aliasMatches(query: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias || normalizedAlias.length < 2) return false;
  return query.includes(normalizedAlias);
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
}
