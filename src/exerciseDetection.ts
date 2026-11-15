export type ExerciseType = 'squat' | 'pushup' | 'jumping-jack' | 'situp' | 'plank' | 'lunge' | 'highknees' | 'deadbug' | 'bridge';
type Landmark = { x: number; y: number; z?: number; visibility?: number };
type Phase = 'ready' | 'down' | 'up' | 'open' | 'closed' | 'hold';
export type { Landmark, Phase };
export function angle(a: Landmark, b: Landmark, c: Landmark) {
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const cb = Math.hypot(c.x - b.x, c.y - b.y);
  if (ab === 0 || cb === 0) return 180;
  const dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
  const cosine = Math.max(-1, Math.min(1, dot / (ab * cb)));
  return Math.acos(cosine) * (180 / Math.PI);
}

export function isHighKneeRaised(pose: Landmark[], hipIndex: number, kneeIndex: number, ankleIndex: number) {
  const hip = pose[hipIndex];
  const knee = pose[kneeIndex];
  const ankle = pose[ankleIndex];
  if (!hip || !knee || !ankle) return false;
  const kneeAngle = angle(hip, knee, ankle);
  // A straight-leg raise is not a high-knee rep. Require clear knee flexion
  // as well as lifting the knee above the hip line.
  return knee.y < hip.y - 0.1 && kneeAngle < 145;
}

export function getMovementPhase(pose: Landmark[], exercise: ExerciseType): { phase: Phase; valid: boolean } {
  const point = (index: number) => pose[index];
  const visible = (indices: number[]) => indices.every(index =>
    point(index) && (point(index).visibility ?? 1) > 0.55
  );
  const side = (left: number[], right: number[]) => {
    const leftVisible = visible(left);
    const rightVisible = visible(right);
    if (!leftVisible && !rightVisible) return null;
    if (leftVisible && rightVisible) {
      const score = (indices: number[]) => indices.reduce((sum, index) => sum + (point(index).visibility ?? 1), 0);
      return score(left) >= score(right) ? left : right;
    }
    return leftVisible ? left : right;
  };

  if (exercise === 'squat') {
    const leg = side([23,25,27], [24,26,28]);
    if (!leg) return { phase: 'ready', valid: false };
    const shoulder = leg[0] === 23 ? 11 : 12;
    if (!visible([shoulder, leg[0]])) return { phase: 'ready', valid: false };
    // Squats require an upright standing torso, not seated knee extensions.
    const torsoDx = Math.abs(point(shoulder).x - point(leg[0]).x);
    const torsoDy = Math.abs(point(shoulder).y - point(leg[0]).y);
    if (torsoDy <= torsoDx * 1.05) return { phase: 'ready', valid: false };
    const knee = angle(point(leg[0]), point(leg[1]), point(leg[2]));
    return { phase: knee < 105 ? 'down' : knee > 155 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'lunge') {
    // Count a lunge when either knee bends, and re-arm only once the visible
    // legs return to standing. This supports alternating left/right lunges.
    const leftVisible = visible([23,25,27]);
    const rightVisible = visible([24,26,28]);
    if (!leftVisible && !rightVisible) return { phase: 'ready', valid: false };
    const torso = side([11,23], [12,24]);
    if (!torso) return { phase: 'ready', valid: false };
    // Reject seated or floor-based leg movements that can mimic a knee bend.
    const torsoDx = Math.abs(point(torso[0]).x - point(torso[1]).x);
    const torsoDy = Math.abs(point(torso[0]).y - point(torso[1]).y);
    if (torsoDy <= torsoDx * 1.05) return { phase: 'ready', valid: false };
    const leftKnee = leftVisible ? angle(point(23), point(25), point(27)) : null;
    const rightKnee = rightVisible ? angle(point(24), point(26), point(28)) : null;
    const anyKneeBent = (leftKnee !== null && leftKnee < 112) || (rightKnee !== null && rightKnee < 112);
    const allVisibleLegsStanding = (leftKnee === null || leftKnee > 150) && (rightKnee === null || rightKnee > 150);
    return {
      phase: anyKneeBent ? 'down' : allVisibleLegsStanding ? 'up' : 'ready',
      valid: true
    };
  }
  if (exercise === 'pushup') {
    const arm = side([11,13,15], [12,14,16]);
    if (!arm) return { phase: 'ready', valid: false };
    const torso = arm[0] === 11 ? [11,23] : [12,24];
    if (!visible(torso)) return { phase: 'ready', valid: false };
    const fullBodyEnd = arm[0] === 11 ? 27 : 28;
    const kneeSupportEnd = arm[0] === 11 ? 25 : 26;
    const alignedBody = (endIndex: number) => {
      if (!visible([torso[0], torso[1], endIndex])) return false;
      const bodyAngle = angle(point(torso[0]), point(torso[1]), point(endIndex));
      const bodyLevel = Math.abs(point(torso[0]).y - point(endIndex).y) < 0.35;
      const bodyExtended = Math.abs(point(torso[0]).x - point(endIndex).x) > 0.18;
      return bodyAngle >= 150 && bodyLevel && bodyExtended;
    };

    // Elbow bending alone also occurs in standing arm curls. Require a
    // straight, near-horizontal body line. Check the ankle for a full push-up,
    // then the knee for a supported knee push-up when the full line is not valid.
    const fullPushup = alignedBody(fullBodyEnd);
    const kneePushup = !fullPushup && alignedBody(kneeSupportEnd);
    if (!fullPushup && !kneePushup) return { phase: 'ready', valid: false };

    const elbow = angle(point(arm[0]), point(arm[1]), point(arm[2]));
    return { phase: elbow < 95 ? 'down' : elbow > 150 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'jumping-jack') {
    if (!visible([11,12,15,16,27,28])) return { phase: 'ready', valid: false };
    const wristY = (point(15).y + point(16).y) / 2;
    const shoulderY = (point(11).y + point(12).y) / 2;
    const feetGap = Math.abs(point(27).x - point(28).x);
    const shoulderGap = Math.max(0.08, Math.abs(point(11).x - point(12).x));
    const open = wristY < shoulderY - 0.04 && feetGap > shoulderGap * 2.1;
    const closed = wristY > shoulderY + 0.02 && feetGap < shoulderGap * 1.65;
    return { phase: open ? 'open' : closed ? 'closed' : 'ready', valid: true };
  }
  if (exercise === 'situp') {
    const torso = side([11,23,25], [12,24,26]);
    if (!torso) return { phase: 'ready', valid: false };
    const hip = angle(point(torso[0]), point(torso[1]), point(torso[2]));
    const horizontal = Math.abs(point(torso[0]).x - point(torso[1]).x);
    const vertical = Math.abs(point(torso[0]).y - point(torso[1]).y);
    const lyingBack = horizontal > vertical * 1.1;
    const sittingUp = vertical > horizontal * 1.1;
    // Reject standing hip bends: a sit-up starts with the torso horizontal
    // and reaches the raised phase with the torso more upright.
    if (hip > 145 && lyingBack) return { phase: 'down', valid: true };
    if (hip < 115 && sittingUp) return { phase: 'up', valid: true };
    return { phase: 'ready', valid: true };
  }
  if (exercise === 'plank') {
    const torso = side([11,23], [12,24]);
    if (!torso) return { phase: 'hold', valid: false };
    const arm = torso[0] === 11 ? [11,13,15] : [12,14,16];
    if (!visible(arm)) return { phase: 'hold', valid: false };
    const ankle = torso[0] === 11 ? 27 : 28;
    const knee = torso[0] === 11 ? 25 : 26;
    const alignedBody = (endIndex: number) => {
      if (!visible([torso[0], torso[1], endIndex])) return false;
      const bodyAngle = angle(point(torso[0]), point(torso[1]), point(endIndex));
      const bodyLevel = Math.abs(point(torso[0]).y - point(endIndex).y) < 0.22;
      const bodyExtended = Math.abs(point(torso[0]).x - point(endIndex).x) > 0.18;
      return bodyAngle > 150 && bodyLevel && bodyExtended;
    };

    // Accept either a full forearm plank (shoulder-to-ankle line) or a
    // knee-supported plank (shoulder-to-knee line). Both require a straight,
    // level torso and elbows positioned beneath the shoulders.
    const fullPlank = alignedBody(ankle);
    const kneePlank = !fullPlank && alignedBody(knee);
    const elbowAngle = angle(point(arm[0]), point(arm[1]), point(arm[2]));
    const elbowBent = elbowAngle > 60 && elbowAngle < 130;
    const elbowUnderShoulder = Math.abs(point(arm[0]).x - point(arm[1]).x) < 0.2;
    return {
      phase: 'hold',
      valid: (fullPlank || kneePlank) && elbowBent && elbowUnderShoulder
    };
  }
  if (exercise === 'highknees') {
    if (!visible([11,12,23,24,25,26,27,28])) return { phase: 'ready', valid: false };
    const shoulderX = (point(11).x + point(12).x) / 2;
    const shoulderY = (point(11).y + point(12).y) / 2;
    const hipX = (point(23).x + point(24).x) / 2;
    const hipY = (point(23).y + point(24).y) / 2;
    const torsoUpright = hipY > shoulderY + 0.08
      && Math.abs(hipY - shoulderY) > Math.abs(hipX - shoulderX);
    if (!torsoUpright) return { phase: 'ready', valid: false };

    const leftKnee = angle(point(23), point(25), point(27));
    const rightKnee = angle(point(24), point(26), point(28));
    const leftRaised = isHighKneeRaised(pose, 23, 25, 27);
    const rightRaised = isHighKneeRaised(pose, 24, 26, 28);
    // One leg must remain nearly straight as the other knee lifts. This
    // rejects seated knee raises and double-knee tucks as high-knee reps.
    const hasStandingSupport = leftRaised && !rightRaised
      ? rightKnee > 150
      : rightRaised && !leftRaised
        ? leftKnee > 150
        : !leftRaised && !rightRaised && (leftKnee > 150 || rightKnee > 150);
    if (!hasStandingSupport || (leftRaised && rightRaised)) return { phase: 'ready', valid: false };
    return { phase: leftRaised || rightRaised ? 'open' : 'closed', valid: true };
  }
  if (exercise === 'deadbug') {
    // Dead bugs alternate legs. Track either extension and re-arm only when
    // the visible legs return to their bent starting position.
    const leftVisible = visible([11,23,25]);
    const rightVisible = visible([12,24,26]);
    if (!leftVisible && !rightVisible) return { phase: 'ready', valid: false };
    const torso = side([11,23], [12,24]);
    if (!torso) return { phase: 'ready', valid: false };
    const torsoHorizontal = Math.abs(point(torso[0]).x - point(torso[1]).x)
      > Math.abs(point(torso[0]).y - point(torso[1]).y) * 1.1;
    if (!torsoHorizontal) return { phase: 'ready', valid: false };
    const leftAngle = leftVisible ? angle(point(11), point(23), point(25)) : null;
    const rightAngle = rightVisible ? angle(point(12), point(24), point(26)) : null;
    const anyLegExtended = (leftAngle !== null && leftAngle > 148)
      || (rightAngle !== null && rightAngle > 148);
    const allVisibleLegsBent = (leftAngle === null || leftAngle < 125)
      && (rightAngle === null || rightAngle < 125);
    return {
      phase: anyLegExtended ? 'up' : allVisibleLegsBent ? 'down' : 'ready',
      valid: true
    };
  }
  const torso = side([11,23,25], [12,24,26]);
  if (!torso) return { phase: 'ready', valid: false };
  const torsoHorizontal = Math.abs(point(torso[0]).x - point(torso[1]).x)
    > Math.abs(point(torso[0]).y - point(torso[1]).y) * 1.1;
  if (!torsoHorizontal) return { phase: 'ready', valid: false };
  const hipAngle = angle(point(torso[0]), point(torso[1]), point(torso[2]));
  return { phase: hipAngle < 130 ? 'down' : hipAngle > 155 ? 'up' : 'ready', valid: true };
}

