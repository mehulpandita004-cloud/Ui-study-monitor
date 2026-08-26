// ==========================================
// Phone & Object Detection with Hand Proximity Check
// Uses COCO-SSD (MobileNet V2) for real-time phone detection
// ==========================================

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Point3D } from './earCalculator';

export interface PhoneDetectionResult {
  phoneDetected: boolean;
  phoneConfidence: number;
  phoneInHand: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
  detectedObjects: { class: string; score: number; bbox: [number, number, number, number] }[];
}

export class PhoneDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  private isLoading: boolean = false;
  private loadAttempts: number = 0;
  private lastLoadAttempt: number = 0;
  private lastInferenceTime: number = 0;
  private lastResult: PhoneDetectionResult = {
    phoneDetected: false,
    phoneConfidence: 0,
    phoneInHand: false,
    detectedObjects: [],
  };

  async loadModel(): Promise<boolean> {
    if (this.model) return true;
    if (this.isLoading) return false;

    // Exponential backoff: wait longer between each retry (max 30s)
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, Math.min(this.loadAttempts, 5)));
    const now = Date.now();
    if (this.loadAttempts > 0 && now - this.lastLoadAttempt < backoffMs) {
      return false; // Still in backoff window
    }

    try {
      this.isLoading = true;
      this.loadAttempts++;
      this.lastLoadAttempt = now;
      console.log(`[PhoneDetector] Loading COCO-SSD model (attempt ${this.loadAttempts})...`);
      this.model = await cocoSsd.load({ base: 'mobilenet_v2' });
      console.log('[PhoneDetector] COCO-SSD model loaded successfully ✓');
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error(`[PhoneDetector] Failed to load COCO-SSD model (attempt ${this.loadAttempts}):`, err);
      this.isLoading = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.model !== null;
  }

  async detectObjects(
    videoElement: HTMLVideoElement,
    poseLandmarks: Point3D[] | null,
    faceLandmarks: Point3D[] | null,
    isLiteMode: boolean = false
  ): Promise<PhoneDetectionResult> {
    // If model isn't loaded yet, try loading it (lazy/retry with no attempt limit)
    if (!this.model && !this.isLoading) {
      this.loadModel().catch(() => {});
    }

    if (isLiteMode || !this.model) {
      return {
        phoneDetected: false,
        phoneConfidence: 0,
        phoneInHand: false,
        detectedObjects: [],
      };
    }

    // Check video readiness
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return this.lastResult;
    }

    const now = Date.now();
    // Run object detection throttled at ~2-3 FPS (every 400ms)
    if (now - this.lastInferenceTime < 400) {
      return this.lastResult;
    }

    try {
      this.lastInferenceTime = now;
      // Use balanced confidence to detect phones without too many false positives
      const predictions = await this.model.detect(videoElement, 8, 0.35);

      // Match 'cell phone', 'remote' (often misidentified as phone), 'phone'
      const phonePredictions = predictions.filter(
        (p) => p.class === 'cell phone' || p.class === 'remote' || p.class === 'phone'
      );

      let phoneDetected = false;
      let phoneConfidence = 0;
      let phoneInHand = false;
      let boundingBox: { x: number; y: number; width: number; height: number } | undefined;

      if (phonePredictions.length > 0) {
        const topPhone = phonePredictions.sort((a, b) => b.score - a.score)[0];
        phoneDetected = true;
        phoneConfidence = Math.round(topPhone.score * 100) / 100;

        const [bx, by, bw, bh] = topPhone.bbox;
        boundingBox = { x: bx, y: by, width: bw, height: bh };

        // Hand-region / Face proximity check
        const videoW = videoElement.videoWidth || 640;
        const videoH = videoElement.videoHeight || 480;
        const phoneCenterNormX = (bx + bw / 2) / videoW;
        const phoneCenterNormY = (by + bh / 2) / videoH;

        let nearHandOrFace = false;

        // Check proximity to wrists (Pose keypoints 15, 16)
        if (poseLandmarks && poseLandmarks.length >= 17) {
          const leftWrist = poseLandmarks[15];
          const rightWrist = poseLandmarks[16];

          if (leftWrist) {
            const d = Math.hypot(leftWrist.x - phoneCenterNormX, leftWrist.y - phoneCenterNormY);
            if (d < 0.3) nearHandOrFace = true;
          }
          if (rightWrist) {
            const d = Math.hypot(rightWrist.x - phoneCenterNormX, rightWrist.y - phoneCenterNormY);
            if (d < 0.3) nearHandOrFace = true;
          }
        }

        // Check proximity to chin/chest area
        if (faceLandmarks && faceLandmarks.length >= 153) {
          const chin = faceLandmarks[152];
          if (chin) {
            const d = Math.hypot(chin.x - phoneCenterNormX, chin.y - phoneCenterNormY);
            if (d < 0.4) nearHandOrFace = true;
          }
        }

        // If phone is detected — mark in-hand if near hand/face OR high confidence
        phoneInHand = nearHandOrFace || topPhone.score > 0.45;

        console.log(
          `[PhoneDetector] 📱 Phone detected: ${topPhone.class} (${(topPhone.score * 100).toFixed(1)}%) inHand=${phoneInHand}`
        );
      }

      this.lastResult = {
        phoneDetected,
        phoneConfidence,
        phoneInHand,
        boundingBox,
        detectedObjects: predictions.map((p) => ({
          class: p.class,
          score: p.score,
          bbox: p.bbox,
        })),
      };

      return this.lastResult;
    } catch (err) {
      console.warn('[PhoneDetector] Error during detection:', err);
      return this.lastResult;
    }
  }
}

export const phoneDetector = new PhoneDetector();
