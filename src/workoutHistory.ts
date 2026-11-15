export type CompletedSession = {
  id: string;
  title: string;
  kind: 'plan' | 'alarm' | 'exercise';
  completedAt: string;
};

export function parseWorkoutHistory(value: unknown, now = Date.now()): CompletedSession[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sessions: CompletedSession[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()) continue;
    if (seen.has(record.id)) continue;
    if (typeof record.title !== 'string' || !record.title.trim()) continue;
    if (record.kind !== 'plan' && record.kind !== 'alarm' && record.kind !== 'exercise') continue;
    if (typeof record.completedAt !== 'string') continue;

    const timestamp = Date.parse(record.completedAt);
    if (!Number.isFinite(timestamp) || timestamp > now) continue;

    seen.add(record.id);
    sessions.push({
      id: record.id,
      title: record.title.trim(),
      kind: record.kind,
      completedAt: record.completedAt
    });
  }

  return sessions;
}
