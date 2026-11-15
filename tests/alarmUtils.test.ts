import { describe, expect, it } from 'vitest';
import { getNextEnabledAlarm, normalizeAlarmMissions } from '../src/alarmUtils';

describe('normalizeAlarmMissions', () => {
  const ids = ['squat', 'plank'] as const;

  it('rounds and clamps valid saved numeric values', () => {
    expect(normalizeAlarmMissions([
      { exerciseId: 'squat', target: 20.7, rounds: 1.8 },
      { exerciseId: 'plank', target: 0, rounds: 99 },
    ], ids)).toEqual([
      { exerciseId: 'squat', target: 21, rounds: 2 },
      { exerciseId: 'plank', target: 1, rounds: 10 },
    ]);
  });

  it('drops malformed or unsupported missions while preserving valid neighbours', () => {
    expect(normalizeAlarmMissions([
      null,
      { exerciseId: 'unknown', target: 10, rounds: 1 },
      { exerciseId: 'squat', target: 'not-a-number', rounds: 1 },
      { exerciseId: 'plank', target: 15, rounds: 2 },
    ], ids)).toEqual([
      { exerciseId: 'plank', target: 15, rounds: 2 },
    ]);
  });

  it('returns an empty list for a non-array stored value', () => {
    expect(normalizeAlarmMissions({ exerciseId: 'squat' }, ids)).toEqual([]);
  });
});

describe('getNextEnabledAlarm', () => {
  const alarms = [
    { id: 'later', time: '09:00', enabled: true },
    { id: 'earlier', time: '07:30', enabled: true },
    { id: 'disabled', time: '06:00', enabled: false },
  ];

  it('selects the earliest upcoming enabled alarm, not the first stored item', () => {
    const now = new Date(2026, 10, 15, 6, 0, 0, 0);
    expect(getNextEnabledAlarm(alarms, now)?.id).toBe('earlier');
  });

  it('rolls alarms at or before local now to tomorrow', () => {
    const now = new Date(2026, 10, 15, 8, 0, 0, 0);
    expect(getNextEnabledAlarm(alarms, now)?.id).toBe('later');
  });

  it('ignores invalid times and returns undefined when no valid enabled alarm exists', () => {
    expect(getNextEnabledAlarm([
      { id: 'off', time: '06:00', enabled: false },
      { id: 'bad', time: '25:30', enabled: true },
    ], new Date(2026, 10, 15, 5, 0))).toBeUndefined();
  });
});
