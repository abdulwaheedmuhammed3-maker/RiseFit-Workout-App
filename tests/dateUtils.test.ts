import { describe, expect, it } from 'vitest';
import { getLocalDateKey, isValidDateOnly } from '../src/dateUtils';

describe('getLocalDateKey', () => {
  it('formats local calendar components without converting to UTC', () => {
    expect(getLocalDateKey(new Date(2026, 10, 15, 0, 5, 0))).toBe('2026-11-15');
  });

  it('pads month and day values', () => {
    expect(getLocalDateKey(new Date(2026, 0, 3, 12))).toBe('2026-01-03');
  });
});

describe('isValidDateOnly', () => {
  it('accepts valid leap days', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2026-04-31')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
  });

  it('rejects non-date and non-string values', () => {
    expect(isValidDateOnly('2026-2-01')).toBe(false);
    expect(isValidDateOnly('not-a-date')).toBe(false);
    expect(isValidDateOnly(null)).toBe(false);
    expect(isValidDateOnly(20261115)).toBe(false);
  });
});
