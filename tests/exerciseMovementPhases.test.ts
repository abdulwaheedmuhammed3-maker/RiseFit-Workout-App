import { test } from 'node:test';
import { equal } from 'node:assert/strict';
import { getMovementPhase, type ExerciseType, type Landmark } from '../src/exerciseDetection.js';

function pose(): Landmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
}
function set(p: Landmark[], index: number, x: number, y: number) {
  p[index] = { x, y, visibility: 1 };
}
function expectPhase(p: Landmark[], exercise: ExerciseType, phase: string, valid = true) {
  const result = getMovementPhase(p, exercise);
  equal(result.valid, valid, exercise + ' validity');
  equal(result.phase, phase, exercise + ' phase');
}

test('squat detector distinguishes bent and upright standing positions', () => {
  const down = pose();
  set(down, 11, .4, .1); set(down, 23, .4, .4); set(down, 25, .4, .6); set(down, 27, .6, .6);
  expectPhase(down, 'squat', 'down');
  const up = pose();
  set(up, 11, .4, .1); set(up, 23, .4, .4); set(up, 25, .4, .6); set(up, 27, .4, .9);
  expectPhase(up, 'squat', 'up');
});

test('jumping-jack detector requires arms overhead and feet apart for open phase', () => {
  const open = pose();
  set(open, 11, .46, .3); set(open, 12, .54, .3);
  set(open, 15, .25, .1); set(open, 16, .75, .1);
  set(open, 27, .1, .9); set(open, 28, .9, .9);
  expectPhase(open, 'jumping-jack', 'open');
  const closed = pose();
  set(closed, 11, .46, .3); set(closed, 12, .54, .3);
  set(closed, 15, .46, .5); set(closed, 16, .54, .5);
  set(closed, 27, .46, .9); set(closed, 28, .54, .9);
  expectPhase(closed, 'jumping-jack', 'closed');
});

test('sit-up detector distinguishes lying and upright phases', () => {
  const down = pose();
  set(down, 11, .1, .5); set(down, 23, .5, .5); set(down, 25, .9, .5);
  expectPhase(down, 'situp', 'down');
  const up = pose();
  set(up, 11, .5, .1); set(up, 23, .5, .5); set(up, 25, .5, .9);
  expectPhase(up, 'situp', 'up');
});

test('glute bridge detector distinguishes lowered and raised hip positions', () => {
  const down = pose();
  set(down, 11, .1, .5); set(down, 23, .5, .5); set(down, 25, .9, .5);
  expectPhase(down, 'bridge', 'down');
  const up = pose();
  set(up, 11, .1, .5); set(up, 23, .5, .5); set(up, 25, .5, .1);
  expectPhase(up, 'bridge', 'up');
});

test('dead bug detector requires a horizontal torso and detects leg extension', () => {
  const down = pose();
  set(down, 11, .1, .5); set(down, 23, .5, .5); set(down, 25, .5, .7);
  expectPhase(down, 'deadbug', 'down');
  const extended = pose();
  set(extended, 11, .1, .5); set(extended, 23, .5, .5); set(extended, 25, .9, .5);
  expectPhase(extended, 'deadbug', 'up');
});

test('lunge detector rejects a horizontal torso pose', () => {
  const p = pose();
  set(p, 11, .1, .5); set(p, 23, .5, .5); set(p, 25, .5, .7); set(p, 27, .5, .9);
  expectPhase(p, 'lunge', 'ready', false);
});
