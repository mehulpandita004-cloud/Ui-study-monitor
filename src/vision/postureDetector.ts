// ==========================================
// Posture & Ergonomics Detector
// Evaluates slouching, shoulder slope, and movement restlessness
// ==========================================

import { Point3D } from './earCalculator';

export interface PostureMetrics {
  isSlouching: boolean;
  postureScore: number; // 0 to 100%
  shoulderSlope: number; // degrees
  shoulderDistance: number; // distance between shoulders in pixels / norm
  movementMagnitude: number; // frame-to-frame motion delta
}

export class PostureDetector {
  private prevKeypoints: Point3D[] = [];

  calculatePosture(
    poseLandmarks: Point3D[] | null,
    faceLandmarks: Point3D[] | null,
    calibratedDistance: number = 180
  ): PostureMetrics {
    // 1. Calculate movement magnitude from frame-to-frame keypoint deltas
    let movementMagnitude = 0;
    const currentPoints = poseLandmarks && poseLandmarks.length > 0 ? poseLandmarks : faceLandmarks;

    if (currentPoints && currentPoints.length > 0 && this.prevKeypoints.length > 0) {
      const sampleCount = Math.min(10, currentPoints.length, this.prevKeypoints.length);
      let totalDelta = 0;

      for (let i = 0; i < sampleCount; i++) {
        const p1 = currentPoints[i];
        const p2 = this.prevKeypoints[i];
        if (p1 && p2) {
          const dx = (p1.x - p2.x) * 100;
          const dy = (p1.y - p2.y) * 100;
          totalDelta += Math.sqrt(dx * dx + dy * dy);
        }
      }
      movementMagnitude = Math.round((totalDelta / sampleCount) * 10);
    }

    if (currentPoints) {
      this.prevKeypoints = currentPoints.slice(0, 10);
    }

    // If pose landmarks are present (MediaPipe Pose)
    if (poseLandmarks && poseLandmarks.length >= 13) {
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const nose = poseLandmarks[0] || (faceLandmarks ? faceLandmarks[1] : null);

      if (leftShoulder && rightShoulder) {
        // Shoulder slope angle
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        const slopeDeg = Math.abs(Math.round((Math.atan2(dy, dx) * 180) / Math.PI));

        // Shoulder distance
        const shoulderDist = Math.sqrt(dx * dx + dy * dy) * 400;

        // Slouch: vertical compression between nose and shoulder line
        let isSlouching = false;
        let postureScore = 90;

        if (nose) {
          const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
          const neckLength = Math.abs(shoulderMidY - nose.y) * 400;

          // If neck length compresses significantly compared to shoulder distance
          const neckToShoulderRatio = shoulderDist > 0 ? neckLength / shoulderDist : 0.6;

          if (neckToShoulderRatio < 0.35) { // Reduced from 0.42 to reduce false positives
            isSlouching = true;
            postureScore = Math.max(30, Math.round(neckToShoulderRatio * 150));
          } else {
            postureScore = Math.min(100, Math.round(neckToShoulderRatio * 140));
          }
        }

        // Penalize uneven shoulders if tilted > 15 degrees
        if (slopeDeg > 15) {
          postureScore = Math.max(20, postureScore - Math.round((slopeDeg - 15) * 2));
        }

        return {
          isSlouching,
          postureScore: Math.max(0, Math.min(100, postureScore)),
          shoulderSlope: slopeDeg,
          shoulderDistance: Math.round(shoulderDist),
          movementMagnitude,
        };
      }
    }

    // Fallback if only face landmarks are available
    if (faceLandmarks && faceLandmarks.length >= 153) {
      const chin = faceLandmarks[152];
      const forehead = faceLandmarks[10];
      const faceHeight = Math.abs((chin?.y || 0.5) - (forehead?.y || 0.2)) * 400;

      return {
        isSlouching: false,
        postureScore: 85,
        shoulderSlope: 0,
        shoulderDistance: Math.round(faceHeight * 1.5),
        movementMagnitude,
      };
    }

    return {
      isSlouching: false,
      postureScore: 80,
      shoulderSlope: 0,
      shoulderDistance: calibratedDistance,
      movementMagnitude,
    };
  }
}
