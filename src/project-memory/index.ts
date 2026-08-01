import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { ProjectRoutingController } from './controller';
import { ProjectResolver } from './resolver';
import { scanProjectRoots, type ScanOptions } from './scanner';
import { ProjectMemoryStore } from './store';

export * from './types';
export * from './scanner';
export * from './store';
export * from './resolver';
export * from './controller';

export interface CreateProjectMemoryOptions {
  roots: string[];
  storePath?: string;
  scan?: ScanOptions;
  refresh?: boolean;
}

export async function createProjectRoutingController(
  options: CreateProjectMemoryOptions,
): Promise<ProjectRoutingController> {
  const storePath = options.storePath ?? join(homedir(), '.lark-channel', 'project-memory.json');
  const store = new ProjectMemoryStore(storePath, options.roots);
  await store.load();

  if (options.refresh !== false) {
    const projects = await scanProjectRoots(options.roots, options.scan);
    store.replaceProjects(projects, options.roots);
    await store.save();
  }

  const resolver = new ProjectResolver(() => store.list());
  return new ProjectRoutingController(resolver, store);
}

export async function createProjectRoutingControllerFromEnv(): Promise<
  ProjectRoutingController | undefined
> {
  const raw = process.env.LARK_PROJECT_ROOTS?.trim();
  if (!raw) return undefined;
  const roots = raw
    .split(delimiter)
    .map((value) => value.trim())
    .filter(Boolean);
  if (roots.length === 0) return undefined;
  return createProjectRoutingController({ roots });
}
