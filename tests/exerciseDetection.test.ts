import { test } from 'node:test';
import { equal, ok } from 'node:assert/strict';
import { angle, getMovementPhase, isHighKneeRaised, type ExerciseType, type Landmark } from '../src/exerciseDetection.js';

const exercises: ExerciseType[] = [
  'squat', 'pushup', 'jumping-jack', 'situp', 'plank',
  'lunge', 'highknees', 'deadbug', 'bridge'
];

test('angle returns a right angle for perpendicular landmarks', () => {
  equal(Math.round(angle(
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }
  )), 90);
});

test('all nine detectors reject a missing pose instead of validating/counting it', () => {
  for (const exercise of exercises) {
    const result = getMovementPhase([], exercise);
    equal(result.valid, false, exercise + ' must reject an empty pose');
  }
});

test('high-knee validation requires a bent knee lifted above the hip', () => {
  const pose: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  pose[23] = { x: 0.5, y: 0.5, visibility: 1 };
  pose[25] = { x: 0.5, y: 0.3, visibility: 1 };
  pose[27] = { x: 0.7, y: 0.3, visibility: 1 };
  ok(isHighKneeRaised(pose, 23, 25, 27), 'bent lifted knee should qualify');

  pose[27] = { x: 0.5, y: 0.1, visibility: 1 };
  equal(isHighKneeRaised(pose, 23, 25, 27), false, 'straight-leg raise must not qualify');
});

test('high-knee validation rejects incomplete landmark triples', () => {
  equal(isHighKneeRaised([], 23, 25, 27), false);
});
