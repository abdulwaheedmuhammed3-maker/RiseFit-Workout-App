export type AlarmMission<TExerciseId extends string = string> = {
  exerciseId: TExerciseId;
  target: number;
  rounds: number;
};

export type AlarmCandidate = {
  id: string;
  time: string;
  enabled: boolean;
};

export function normalizeAlarmMissions<TExerciseId extends string>(
  value: unknown,
  validExerciseIds: readonly TExerciseId[],
): AlarmMission<TExerciseId>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): AlarmMission<TExerciseId>[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const mission = entry as Record<string, unknown>;
    if (typeof mission.exerciseId !== 'string'
      || !validExerciseIds.includes(mission.exerciseId as TExerciseId)) return [];
    const target = Number(mission.target);
    const rounds = Number(mission.rounds);
    if (!Number.isFinite(target) || !Number.isFinite(rounds)) return [];
    return [{
      exerciseId: mission.exerciseId as TExerciseId,
      target: Math.max(1, Math.min(300, Math.round(target))),
      rounds: Math.max(1, Math.min(10, Math.round(rounds))),
    }];
  });
}

export function getNextEnabledAlarm<TAlarm extends AlarmCandidate>(
  alarms: readonly TAlarm[],
  now: Date,
): TAlarm | undefined {
  let selected: TAlarm | undefined;
  let selectedAt = Number.POSITIVE_INFINITY;
  for (const alarm of alarms) {
    if (!alarm.enabled || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(alarm.time)) continue;
    const [hour, minute] = alarm.time.split(':').map(Number);
    const nextOccurrence = new Date(now);
    nextOccurrence.setHours(hour, minute, 0, 0);
    if (nextOccurrence <= now) nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    const time = nextOccurrence.getTime();
    if (time < selectedAt) {
      selected = alarm;
      selectedAt = time;
    }
  }
  return selected;
}
