export interface ProjectRecord {
  id: string;
  /** Stable logical identity shared by worktrees/checkouts of one project. */
  identityKey?: string;
  name: string;
  path: string;
  description: string;
  aliases: string[];
  keywords: string[];
  markers: string[];
  lastActiveAt: number;
  updatedAt: number;
}

export interface ProjectIndex {
  schemaVersion: 1;
  generatedAt: number;
  roots: string[];
  projects: ProjectRecord[];
}

export interface ResolutionContext {
  currentPath?: string;
  recentPaths?: string[];
  now?: number;
}

export interface ResolutionCandidate {
  project: ProjectRecord;
  score: number;
  reasons: string[];
}

export type ProjectResolution =
  | {
      kind: 'current';
      project: ProjectRecord;
      candidates: ResolutionCandidate[];
      reason: string;
    }
  | {
      kind: 'auto';
      project: ProjectRecord;
      candidates: ResolutionCandidate[];
      reason: string;
    }
  | {
      kind: 'confirm';
      candidates: ResolutionCandidate[];
      reason: string;
    }
  | {
      kind: 'none';
      candidates: ResolutionCandidate[];
      reason: string;
    };

export interface PendingProjectChoice {
  scope: string;
  originalPrompt: string;
  candidates: ResolutionCandidate[];
  createdAt: number;
}

export type RoutingDecision =
  | {
      kind: 'cancel';
      markdown: string;
      reason: string;
    }
  | {
      kind: 'pass';
      prompt: string;
      cwd?: string;
      project?: ProjectRecord;
      reason: string;
    }
  | {
      kind: 'route';
      prompt: string;
      cwd: string;
      project: ProjectRecord;
      changed: boolean;
      reason: string;
    }
  | {
      kind: 'ask';
      markdown: string;
      candidates: ResolutionCandidate[];
      reason: string;
    };
