import type { ProjectRecord } from './types';
import { normalizeText } from './tokenize';

/** Return a stable identity for a logical project, not one checkout path. */
export function projectIdentityKey(project: Pick<ProjectRecord, 'identityKey' | 'name' | 'description'>): string {
  return project.identityKey?.trim().toLowerCase() || contentIdentityKey(project.name, project.description);
}

export function contentIdentityKey(name: string, description: string): string {
  return `content:${normalizeText(name)}|${normalizeText(description).slice(0, 320)}`;
}
