// ==========================================
// 3D Head Pose & Gaze Estimation
// Estimates Pitch, Yaw, Roll from facial landmarks
// ==========================================

import { Point3D } from './earCalculator';

export interface HeadPoseResult {
  pitch: number; // degrees: positive = down (nodding), negative = up
  yaw: number; // degrees: positive = right, negative = left
  roll: number; // degrees: positive = tilt right, negative = tilt left
  isHeadDropped: boolean;
  isLookingAway: boolean;
}

export function estimateHeadPose(
  landmarks: Point3D[],
  calibratedPitch: number = 5.0,
  calibratedYaw: number = 0.0,
  pitchThreshold: number = 22,
  yawThreshold: number = 25
): HeadPoseResult {
  if (!landmarks || landmarks.length < 468) {
    return {
      pitch: 0,
      yaw: 0,
      roll: 0,
      isHeadDropped: false,
      isLookingAway: false,
    };
  }

  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const leftMouth = landmarks[61];
  const rightMouth = landmarks[291];

  if (!noseTip || !chin || !forehead || !leftEyeOuter || !rightEyeOuter) {
    return { pitch: 0, yaw: 0, roll: 0, isHeadDropped: false, isLookingAway: false };
  }

  // 1. Roll: angle of line between left and right eye corners
  const eyeDx = rightEyeOuter.x - leftEyeOuter.x;
  const eyeDy = rightEyeOuter.y - leftEyeOuter.y;
  const rollRad = Math.atan2(eyeDy, eyeDx);
  const roll = Math.round((rollRad * 180) / Math.PI);

  // 2. Yaw: horizontal displacement of nose relative to eye midpoint
  const eyeMidX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
  const eyeWidth = Math.abs(rightEyeOuter.x - leftEyeOuter.x);
  let rawYaw = 0;
  if (eyeWidth > 0.001) {
    const noseOffset = (noseTip.x - eyeMidX) / eyeWidth;
    // Scale to approximate degrees (-90 to +90)
    rawYaw = Math.round(noseOffset * 100);
  }
  const yaw = Math.max(-90, Math.min(90, rawYaw));

  // 3. Pitch: vertical displacement of nose relative to forehead-chin axis
  const faceHeight = Math.abs(chin.y - forehead.y);
  let rawPitch = 5; // slight natural downward gaze
  if (faceHeight > 0.001) {
    const upperRatio = (noseTip.y - forehead.y) / faceHeight;
    // Standard neutral upper ratio is ~0.60
    const pitchDeviation = (upperRatio - 0.60) * 120;
    rawPitch = Math.round(pitchDeviation);
  }
  const pitch = Math.max(-90, Math.min(90, rawPitch));

  // Check against calibrated baseline
  const deltaYaw = Math.abs(yaw - calibratedYaw);
  const deltaPitch = pitch - calibratedPitch;

  const isLookingAway = deltaYaw > yawThreshold || Math.abs(deltaPitch) > pitchThreshold;
  const isHeadDropped = deltaPitch > 18; // significantly dropped chin/neck

  return {
    pitch,
    yaw,
    roll,
    isHeadDropped,
    isLookingAway,
  };
}
