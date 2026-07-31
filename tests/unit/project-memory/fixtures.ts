import type { ProjectRecord } from '../../../src/project-memory/types.js';

export const NOW = Date.parse('2026-08-01T02:00:00+08:00');
export const FIXTURE_ROOT = 'D:\\fixture-workspaces';

export function project(
  name: string,
  path: string,
  description: string,
  aliases: string[],
  keywords: string[],
  lastActiveAt = NOW - 60_000,
): ProjectRecord {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    path,
    description,
    aliases,
    keywords,
    markers: ['.git', 'package.json'],
    lastActiveAt,
    updatedAt: lastActiveAt,
  };
}

export const SAMPLE_PROJECTS: ProjectRecord[] = [
  project(
    'Sample Notes',
    `${FIXTURE_ROOT}\\nodus`,
    '本地优先的笔记与知识管理软件，包含星图、关系图、段落引用和移动端。',
    ['Sample Notes', '笔记软件', '星图项目', '关系图笔记'],
    ['笔记', '星图', '关系图', '知识管理', '段落引用', '移动端'],
  ),
  project(
    'Sample Video',
    `${FIXTURE_ROOT}\\video-forge`,
    '视频生产工具，负责字幕时间轴、配音、自动配画和剪映草稿导出。',
    ['Sample Video', '视频项目', '做剪映草稿的', '自动配画项目'],
    ['视频', '字幕', '时间轴', '配音', '剪映', '草稿', '自动配画'],
    NOW - 3_600_000,
  ),
  project(
    'Sample Archive',
    `${FIXTURE_ROOT}\\kv-archive`,
    '保存对话、网页导出、增量更新和自动文件命名。',
    ['Sample Archive', '对话存档工具', '保存对话的'],
    ['对话', '存档', '导出', '增量', '文件名'],
    NOW - 7_200_000,
  ),
  project(
    'Sample Browser Bridge',
    `${FIXTURE_ROOT}\\kv-browser-bridge`,
    '浏览器与 Windows Computer Use 控制桥接。',
    ['浏览器控制 bridge', 'Windows 控制中心', 'browser bridge'],
    ['浏览器', 'windows', 'computer', 'use', '控制', 'bridge'],
    NOW - 10_800_000,
  ),
  project(
    'Sample Feishu Bridge',
    `${FIXTURE_ROOT}\\sample-feishu-bridge`,
    '通过飞书向本地 Codex 发送任务并接收结果。',
    ['飞书 bridge', 'codex bridge', '手机 codex'],
    ['飞书', 'codex', '手机', 'bridge', '消息'],
    NOW - 14_400_000,
  ),
];
