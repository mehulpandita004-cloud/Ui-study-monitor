// ==========================================
// AI Study Monitor — Unified Vision Pipeline
// Orchestrates MediaPipe Face & Pose, Object Detection, and HUD Canvas Rendering
// ==========================================

import { FilesetResolver, FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { RawVisionFrame, AppSettings, CalibrationProfile } from '../types';
import { calculateEyeMetrics, Point3D } from './earCalculator';
import { estimateHeadPose } from './headPose';
import { PostureDetector } from './postureDetector';
import { phoneDetector } from './phoneDetector';
import { analyzeFrameLighting } from './lightingAnalyzer';

export class VisionPipeline {
  private faceLandmarker: FaceLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private postureDetector = new PostureDetector();
  private isInitializing: boolean = false;
  private isReady: boolean = false;

  private tempCanvas: HTMLCanvasElement | null = null;
  private lastInferenceTime: number = 0;
  private fpsCounter: number = 0;
  private lastFpsCheck: number = Date.now();
  private currentFps: number = 0;

  async initialize(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    try {
      this.isInitializing = true;
      this.tempCanvas = document.createElement('canvas');

      const visionWasm = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Initialize Face Landmarker (Mesh + Iris)
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(visionWasm, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      } catch (gpuErr) {
        console.warn('Face Landmarker GPU delegate failed, falling back to CPU:', gpuErr);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(visionWasm, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      }

      // Initialize Pose Landmarker
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(visionWasm, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      } catch (poseErr) {
        console.warn('Pose Landmarker GPU failed, falling back to CPU:', poseErr);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(visionWasm, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }

      // Load phone detector (await so it's ready for detection)
      const phoneLoaded = await phoneDetector.loadModel();
      console.log('[VisionPipeline] Phone detector loaded:', phoneLoaded);

      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err) {
      console.error('Failed to initialize MediaPipe Vision Pipeline:', err);
      this.isInitializing = false;
      return false;
    }
  }

  getStatus() {
    return {
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      fps: this.currentFps,
      isObjectDetectorReady: phoneDetector.isReady(),
    };
  }

  async processVideoFrame(
    video: HTMLVideoElement,
    settings: AppSettings,
    calibration: CalibrationProfile,
    overlayCanvas?: HTMLCanvasElement | null
  ): Promise<RawVisionFrame | null> {
    if (!this.isReady || !video || video.readyState < 2 || video.videoWidth === 0) {
      return null;
    }

    const now = performance.now();
    const timestampMs = Date.now();

    // Measure FPS
    this.fpsCounter++;
    if (timestampMs - this.lastFpsCheck >= 1000) {
      this.currentFps = this.fpsCounter;
      this.fpsCounter = 0;
      this.lastFpsCheck = timestampMs;
    }

    let facePoints: Point3D[] | null = null;
    let posePoints: Point3D[] | null = null;

    // 1. Run MediaPipe Face Landmarker
    if (this.faceLandmarker) {
      try {
        const faceResult = this.faceLandmarker.detectForVideo(video, now);
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          facePoints = faceResult.faceLandmarks[0] as Point3D[];
        }
      } catch (e) {
        // Drop frame on timing collision
      }
    }

    // 2. Run MediaPipe Pose Landmarker
    if (this.poseLandmarker) {
      try {
        const poseResult = this.poseLandmarker.detectForVideo(video, now);
        if (poseResult.landmarks && poseResult.landmarks.length > 0) {
          posePoints = poseResult.landmarks[0] as Point3D[];
        }
      } catch (e) {
        // Drop frame on timing collision
      }
    }

    // 3. Compute Eye Metrics (EAR, closure, gaze)
    const eyeMetrics = calculateEyeMetrics(
      facePoints || [],
      calibration.neutralEAR,
      settings.earThresholdRatio
    );

    // 4. Compute 3D Head Pose (Pitch, Yaw, Roll, Looking Away)
    const headPose = estimateHeadPose(
      facePoints || [],
      calibration.neutralPitch,
      calibration.neutralYaw,
      settings.pitchTurnThresholdDeg,
      settings.yawTurnThresholdDeg
    );

    // 5. Compute Posture & Motion Ergonomics
    const postureMetrics = this.postureDetector.calculatePosture(
      posePoints,
      facePoints,
      calibration.neutralShoulderDistance
    );

    // 6. Object / Phone Detection
    const phoneResult = await phoneDetector.detectObjects(
      video,
      posePoints,
      facePoints,
      settings.liteMode
    );

    // 7. Lighting Analysis
    if (!this.tempCanvas) this.tempCanvas = document.createElement('canvas');
    const lighting = analyzeFrameLighting(video, this.tempCanvas);

    const isFaceDetected = facePoints !== null && facePoints.length > 0;
    const isPersonDetected = isFaceDetected || (posePoints !== null && posePoints.length > 0);

    const frame: RawVisionFrame = {
      timestamp: timestampMs,
      isFaceDetected,
      ear: eyeMetrics.avgEAR,
      eyeOpenness: eyeMetrics.eyeOpenness,
      isEyeClosed: eyeMetrics.isEyeClosed,
      headPitch: headPose.pitch,
      headYaw: headPose.yaw,
      headRoll: headPose.roll,
      isLookingAway: headPose.isLookingAway,
      isHeadDropped: headPose.isHeadDropped,
      gazeX: eyeMetrics.gazeX,
      gazeY: eyeMetrics.gazeY,

      isPersonDetected,
      isSlouching: postureMetrics.isSlouching,
      postureScore: postureMetrics.postureScore,
      shoulderSlope: postureMetrics.shoulderSlope,
      shoulderDistance: postureMetrics.shoulderDistance,
      movementMagnitude: postureMetrics.movementMagnitude,

      phoneDetected: phoneResult.phoneDetected,
      phoneConfidence: phoneResult.phoneConfidence,
      phoneBoundingBox: phoneResult.boundingBox,
      phoneInHand: phoneResult.phoneInHand,

      lightingScore: lighting.lightingScore,
      lightingCondition: lighting.condition,
    };

    // 8. Render HUD Canvas Overlay if requested
    if (overlayCanvas && settings.showLandmarkOverlay) {
      this.drawHUD(overlayCanvas, video, facePoints, posePoints, phoneResult, frame);
    } else if (overlayCanvas && !settings.showLandmarkOverlay) {
      const ctx = overlayCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    return frame;
  }

  private drawHUD(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    facePoints: Point3D[] | null,
    posePoints: Point3D[] | null,
    phoneResult: any,
    frame: RawVisionFrame
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    // Draw Pose Skeleton
    if (posePoints && posePoints.length >= 17) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)'; // Brand Indigo
      ctx.fillStyle = '#6366F1';

      // Connect shoulders & neck
      const ls = posePoints[11];
      const rs = posePoints[12];
      const nose = posePoints[0];

      if (ls && rs) {
        ctx.beginPath();
        ctx.moveTo(ls.x * w, ls.y * h);
        ctx.lineTo(rs.x * w, rs.y * h);
        if (nose) {
          ctx.lineTo(nose.x * w, nose.y * h);
          ctx.lineTo(ls.x * w, ls.y * h);
        }
        ctx.stroke();

        // Draw shoulder points
        [ls, rs].forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Draw Face Mesh Contour & Iris Highlights
    if (facePoints && facePoints.length >= 468) {
      ctx.fillStyle = frame.isEyeClosed ? '#EF4444' : '#10B981';

      // Draw Eye Landmark Dots
      const eyeIndices = [33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380];
      eyeIndices.forEach((idx) => {
        const pt = facePoints[idx];
        if (pt) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw Chin & Nose indicator
      const nose = facePoints[1];
      if (nose) {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(nose.x * w, nose.y * h, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw Gaze / Head Pose Direction Vector
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(nose.x * w, nose.y * h);
        const vectorLen = 30;
        const targetX = nose.x * w + (frame.headYaw / 45) * vectorLen;
        const targetY = nose.y * h + (frame.headPitch / 45) * vectorLen;
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }
    }

    // Draw Phone Bounding Box
    if (phoneResult.phoneDetected && phoneResult.boundingBox) {
      const { x, y, width, height } = phoneResult.boundingBox;
      ctx.lineWidth = 2;
      ctx.strokeStyle = phoneResult.phoneInHand ? '#F97316' : '#FBBF24';
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = phoneResult.phoneInHand ? '#F97316' : '#FBBF24';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(
        `Phone ${Math.round(phoneResult.phoneConfidence * 100)}% ${phoneResult.phoneInHand ? '(In Use)' : ''}`,
        x + 4,
        Math.max(16, y - 6)
      );
    }
  }
}

export const visionPipeline = new VisionPipeline();
