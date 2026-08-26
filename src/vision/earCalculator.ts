// ==========================================
// Eye Aspect Ratio (EAR) & Eye Openness Calculator
// Computes eyelid distance normalized by eye width
// ==========================================

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

// MediaPipe 468/478 Face Landmark canonical indices for eyes
// Left Eye: 33 (outer), 160 (top 1), 158 (top 2), 133 (inner), 153 (bottom 2), 144 (bottom 1)
// Right Eye: 362 (outer), 385 (top 1), 387 (top 2), 263 (inner), 373 (bottom 2), 380 (bottom 1)
export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];

// Iris landmarks (MediaPipe Face Mesh with Iris)
export const LEFT_IRIS_CENTER = 468;
export const RIGHT_IRIS_CENTER = 473;

function euclideanDistance(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateEyeAspectRatio(landmarks: Point3D[], eyeIndices: number[]): number {
  if (!landmarks || landmarks.length < 468) return 0.28;

  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((idx) => landmarks[idx]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.28;

  // Vertical distances
  const v1 = euclideanDistance(p2, p6);
  const v2 = euclideanDistance(p3, p5);

  // Horizontal distance
  const h = euclideanDistance(p1, p4);

  if (h === 0) return 0;
  return (v1 + v2) / (2.0 * h);
}

export function calculateEyeMetrics(
  landmarks: Point3D[],
  calibratedNeutralEAR: number = 0.28,
  thresholdRatio: number = 0.72
) {
  if (!landmarks || landmarks.length < 468) {
    return {
      leftEAR: 0.28,
      rightEAR: 0.28,
      avgEAR: 0.28,
      eyeOpenness: 100,
      isEyeClosed: false,
      gazeX: 0,
      gazeY: 0,
    };
  }

  const leftEAR = calculateEyeAspectRatio(landmarks, LEFT_EYE_INDICES);
  const rightEAR = calculateEyeAspectRatio(landmarks, RIGHT_EYE_INDICES);
  const avgEAR = (leftEAR + rightEAR) / 2.0;

  const baselineEAR = Math.max(0.18, calibratedNeutralEAR || 0.28);
  const earRatio = avgEAR / baselineEAR;
  const eyeOpenness = Math.max(0, Math.min(100, Math.round(earRatio * 100)));
  const isEyeClosed = earRatio < thresholdRatio;

  // Gaze estimation from iris position relative to eye corners
  let gazeX = 0;
  let gazeY = 0;

  if (landmarks[LEFT_IRIS_CENTER] && landmarks[33] && landmarks[133]) {
    const iris = landmarks[LEFT_IRIS_CENTER];
    const outer = landmarks[33];
    const inner = landmarks[133];
    const eyeWidth = Math.abs(outer.x - inner.x);
    if (eyeWidth > 0) {
      const midX = (outer.x + inner.x) / 2;
      gazeX = (iris.x - midX) / (eyeWidth / 2);
    }
  }

  return {
    leftEAR: Math.round(leftEAR * 1000) / 1000,
    rightEAR: Math.round(rightEAR * 1000) / 1000,
    avgEAR: Math.round(avgEAR * 1000) / 1000,
    eyeOpenness,
    isEyeClosed,
    gazeX: Math.max(-1, Math.min(1, gazeX)),
    gazeY: Math.max(-1, Math.min(1, gazeY)),
  };
}
