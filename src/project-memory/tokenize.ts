const STOP_WORDS = new Set([
  '一个', '这个', '那个', '一下', '帮我', '看看', '继续', '项目', '软件', '工具',
  '系统', '应用', '仓库', '里面', '之前', '最近', '上次', '昨天', '前天', '前几天',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'project', 'app', 'tool',
]);

export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  const out = new Set<string>();

  for (const part of normalized.split(/[^\p{L}\p{N}_-]+/u)) {
    const token = part.trim();
    if (!token || STOP_WORDS.has(token)) continue;
    if (/^[a-z0-9_-]+$/i.test(token)) {
      out.add(token);
      for (const sub of token.split(/[-_]+/)) {
        if (sub.length >= 2 && !STOP_WORDS.has(sub)) out.add(sub);
      }
      continue;
    }

    if (/^[\p{Script=Han}]+$/u.test(token)) {
      if (token.length <= 8 && !STOP_WORDS.has(token)) out.add(token);
      for (let i = 0; i < token.length - 1; i += 1) {
        const bigram = token.slice(i, i + 2);
        if (!STOP_WORDS.has(bigram)) out.add(bigram);
      }
      continue;
    }

    if (token.length >= 2) out.add(token);
  }

  return [...out];
}

export function overlapCount(a: readonly string[], b: readonly string[]): number {
  const right = new Set(b);
  let count = 0;
  for (const value of new Set(a)) {
    if (right.has(value)) count += 1;
  }
  return count;
}

export function compactAlias(input: string): string | undefined {
  const normalized = normalizeText(input)
    .replace(/[，。！？、,.!?;；:：()（）\[\]【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || normalized.length > 36) return undefined;
  if (!/(那个|这个|上次|之前|软件|工具|项目|网站|应用|系统|bridge|助手)/i.test(normalized)) {
    return undefined;
  }
  return normalized;
}
