import { test } from 'node:test';
import { equal } from 'node:assert/strict';
import { parseWorkoutHistory } from '../src/workoutHistory.js';

const now = Date.parse('2026-11-15T12:00:00.000Z');
const valid = { id: 'session-1', title: 'Morning workout', kind: 'plan', completedAt: '2026-11-15T10:00:00.000Z' };

test('restores valid completed sessions', () => {
  const result = parseWorkoutHistory([valid], now);
  equal(result.length, 1);
  equal(result[0].id, valid.id);
  equal(result[0].title, valid.title);
});

test('rejects malformed, empty, unknown-kind and future sessions', () => {
  const result = parseWorkoutHistory([
    null,
    { ...valid, id: '' },
    { ...valid, title: '  ' },
    { ...valid, kind: 'unknown' },
    { ...valid, completedAt: 'not-a-date' },
    { ...valid, completedAt: '2026-11-16T10:00:00.000Z' }
  ], now);
  equal(result.length, 0);
});

test('deduplicates session IDs while preserving the first valid record', () => {
  const duplicate = { ...valid, title: 'Duplicate title' };
  const result = parseWorkoutHistory([valid, duplicate], now);
  equal(result.length, 1);
  equal(result[0].title, valid.title);
});

test('trims whitespace from restored session titles', () => {
  const result = parseWorkoutHistory([{ ...valid, title: '  Walk  ' }], now);
  equal(result[0].title, 'Walk');
});
