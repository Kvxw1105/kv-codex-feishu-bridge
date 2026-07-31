import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ProjectIndex, ProjectRecord } from './types';
import { normalizeText } from './tokenize';

export class ProjectMemoryStore {
  private index: ProjectIndex;
  private readonly filePath: string;

  constructor(filePath: string, roots: readonly string[] = []) {
    this.filePath = filePath;
    this.index = {
      schemaVersion: 1,
      generatedAt: 0,
      roots: [...roots],
      projects: [],
    };
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as ProjectIndex;
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.projects)) {
        throw new Error('unsupported project memory schema');
      }
      this.index = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }

  list(): ProjectRecord[] {
    return this.index.projects.map(cloneProject);
  }

  roots(): string[] {
    return [...this.index.roots];
  }

  replaceProjects(projects: readonly ProjectRecord[], roots = this.index.roots): void {
    const learned = new Map(
      this.index.projects.map((project) => [pathKey(project.path), project.aliases]),
    );
    this.index = {
      schemaVersion: 1,
      generatedAt: Date.now(),
      roots: [...roots],
      projects: projects.map((project) => ({
        ...cloneProject(project),
        aliases: unique([...(learned.get(pathKey(project.path)) ?? []), ...project.aliases]),
      })),
    };
  }

  addAlias(projectPath: string, alias: string): boolean {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return false;
    const project = this.index.projects.find((entry) => pathKey(entry.path) === pathKey(projectPath));
    if (!project) return false;
    if (project.aliases.some((value) => normalizeText(value) === normalizedAlias)) return false;
    project.aliases.push(alias.trim());
    project.updatedAt = Date.now();
    return true;
  }

  touch(projectPath: string, at = Date.now()): boolean {
    const project = this.index.projects.find((entry) => pathKey(entry.path) === pathKey(projectPath));
    if (!project) return false;
    project.lastActiveAt = Math.max(project.lastActiveAt, at);
    project.updatedAt = at;
    return true;
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(this.index, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(tempPath, this.filePath);
  }
}

function cloneProject(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    aliases: [...project.aliases],
    keywords: [...project.keywords],
    markers: [...project.markers],
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}
