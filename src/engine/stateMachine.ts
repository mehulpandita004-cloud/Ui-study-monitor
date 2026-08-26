// ==========================================
// AI Study Monitor — State Machine with Hysteresis
// (Section 4 of Technical Specification)
// ==========================================

import { StudyState, RawVisionFrame, AppSettings, CalibrationProfile } from '../types';

export interface StateTransitionEvent {
  previousState: StudyState;
  newState: StudyState;
  timestamp: number;
  confidence: number;
  reason: string;
}

export interface StateMachineStatus {
  currentState: StudyState;
  stateConfidence: number;
  stateDurationSec: number;
  timeInCurrentStateMs: number;
  recoveryProgressPercent: number;
  displayLabel: string;
  statusLevel: 'focused' | 'mild_drift' | 'distracted' | 'needs_attention' | 'neutral';
  signals: {
    drowsyEvidenceSec: number;
    phoneEvidenceSec: number;
    lookingAwayEvidenceSec: number;
    awayEvidenceSec: number;
    movementCount30s: number;
  };
}

export class StudyStateMachine {
  private currentState: StudyState = 'STUDYING';
  private stateEnteredAt: number = Date.now();
  private lastEvaluationTime: number = Date.now();

  // Temporal Buffers (sliding window of raw frames)
  private frameHistory: RawVisionFrame[] = [];
  private readonly maxHistorySeconds = 35; // keep last 35 seconds of frames

  // Manual Overrides
  private isBreakOverride: boolean = false;
  private isMonitoringPaused: boolean = false;
  private monitoringPausedUntil: number = 0;

  // Recovery tracking
  private studyingRecoveryStartTime: number | null = null;

  // Movement spike timestamps (for 3 in 30s threshold)
  private movementSpikes: number[] = [];

  constructor(
    private settings: AppSettings,
    private calibration: CalibrationProfile,
    private onStateChange?: (transition: StateTransitionEvent) => void
  ) {}

  updateConfig(settings: AppSettings, calibration: CalibrationProfile) {
    this.settings = settings;
    this.calibration = calibration;
  }

  setBreakOverride(isBreak: boolean) {
    this.isBreakOverride = isBreak;
    if (isBreak && this.currentState !== 'BREAK') {
      this.transitionTo('BREAK', 1.0, 'Manual break override active');
    } else if (!isBreak && this.currentState === 'BREAK') {
      this.transitionTo('STUDYING', 0.95, 'Manual break ended');
    }
  }

  setMonitoringPause(durationMinutes: number) {
    if (durationMinutes <= 0) {
      this.isMonitoringPaused = false;
      this.monitoringPausedUntil = 0;
    } else {
      this.isMonitoringPaused = true;
      this.monitoringPausedUntil = Date.now() + durationMinutes * 60 * 1000;
    }
  }

  isPaused(): boolean {
    if (this.isMonitoringPaused && Date.now() > this.monitoringPausedUntil) {
      this.isMonitoringPaused = false;
      this.monitoringPausedUntil = 0;
    }
    return this.isMonitoringPaused;
  }

  getRemainingPauseSeconds(): number {
    if (!this.isPaused()) return 0;
    return Math.max(0, Math.ceil((this.monitoringPausedUntil - Date.now()) / 1000));
  }

  processFrame(frame: RawVisionFrame): StateMachineStatus {
    const now = frame.timestamp || Date.now();
    this.lastEvaluationTime = now;

    // Check pause timeout
    if (this.isPaused()) {
      return this.getStatus(0.9, 'Monitoring Paused', 'neutral');
    }

    if (this.isBreakOverride) {
      return this.getStatus(1.0, 'On Break', 'neutral');
    }

    // 1. Maintain sliding window of frames
    this.frameHistory.push(frame);
    const cutoff = now - this.maxHistorySeconds * 1000;
    this.frameHistory = this.frameHistory.filter((f) => f.timestamp >= cutoff);

    // Track movement spikes
    if (frame.movementMagnitude > 35) {
      this.movementSpikes.push(now);
    }
    this.movementSpikes = this.movementSpikes.filter((t) => t >= now - 30000);

    // 2. Evaluate Evidence Signals over Temporal Windows
    const drowsyEvidenceSec = this.calculateSustainedDuration((f) => {
      // Drowsiness: eye closed or EAR below threshold + head drop boost
      const earThreshold = (this.calibration.neutralEAR || 0.28) * this.settings.earThresholdRatio;
      const eyeClosed = f.isEyeClosed || f.ear < earThreshold || f.eyeOpenness < 25;
      return f.isFaceDetected && eyeClosed;
    });

    const phoneEvidenceSec = this.calculateSustainedDuration((f) => {
      // Phone usage: phone detected AND (in hand/near face OR high confidence alone)
      return f.phoneDetected && (f.phoneInHand || f.phoneConfidence >= 0.50) && f.phoneConfidence >= 0.40;
    });

    const lookingAwayEvidenceSec = this.calculateSustainedDuration((f) => {
      if (!f.isFaceDetected) return false;
      const yawDelta = Math.abs(f.headYaw - (this.calibration.neutralYaw || 0));
      const pitchDelta = Math.abs(f.headPitch - (this.calibration.neutralPitch || 5));
      const gazeDeviated = Math.abs(f.gazeX) > 0.45;
      return yawDelta > this.settings.yawTurnThresholdDeg || pitchDelta > this.settings.pitchTurnThresholdDeg || gazeDeviated;
    });

    const awayEvidenceSec = this.calculateSustainedDuration((f) => {
      // Away from desk: neither face nor person detected
      return !f.isPersonDetected && !f.isFaceDetected;
    });

    const isPoorLightingOrObstructed =
      !frame.isFaceDetected && frame.isPersonDetected && frame.lightingScore < 30;

    const movementCount30s = this.movementSpikes.length;

    // 3. State Machine Priority Resolution
    let candidateState: StudyState = 'STUDYING';
    let candidateConfidence = 0.9;
    let candidateReason = 'Sustained study focus';

    if (awayEvidenceSec >= this.settings.awayThresholdSec) {
      candidateState = 'AWAY_FROM_DESK';
      candidateConfidence = Math.min(0.98, 0.85 + (awayEvidenceSec - this.settings.awayThresholdSec) * 0.03);
      candidateReason = `No presence detected for ${awayEvidenceSec.toFixed(1)}s`;
    } else if (drowsyEvidenceSec >= this.settings.drowsyThresholdSec) {
      candidateState = 'DROWSY';
      candidateConfidence = Math.min(0.96, 0.8 + (drowsyEvidenceSec - this.settings.drowsyThresholdSec) * 0.05);
      candidateReason = `Continuous eye closure for ${drowsyEvidenceSec.toFixed(1)}s`;
    } else if (phoneEvidenceSec >= this.settings.phoneThresholdSec) {
      candidateState = 'PHONE_USAGE';
      candidateConfidence = Math.min(0.95, 0.82 + (phoneEvidenceSec - this.settings.phoneThresholdSec) * 0.04);
      candidateReason = `Active phone interaction for ${phoneEvidenceSec.toFixed(1)}s`;
    } else if (lookingAwayEvidenceSec >= this.settings.lookingAwayThresholdSec) {
      candidateState = 'LOOKING_AWAY';
      candidateConfidence = Math.min(0.92, 0.72 + (lookingAwayEvidenceSec - this.settings.lookingAwayThresholdSec) * 0.02);
      candidateReason = `Gaze turned away for ${lookingAwayEvidenceSec.toFixed(1)}s`;
    } else if (movementCount30s >= this.settings.excessiveMovementThresholdCount) {
      candidateState = 'EXCESSIVE_MOVEMENT';
      candidateConfidence = 0.75;
      candidateReason = `${movementCount30s} restlessness spikes in last 30s`;
    } else if (isPoorLightingOrObstructed) {
      candidateState = 'UNKNOWN';
      candidateConfidence = 0.6;
      candidateReason = 'Low lighting or camera obstructed';
    }

    // 4. Hysteresis & State Transition Evaluation
    if (this.currentState === 'STUDYING') {
      if (candidateState !== 'STUDYING') {
        this.transitionTo(candidateState, candidateConfidence, candidateReason);
        this.studyingRecoveryStartTime = null;
      }
    } else {
      // If we are currently in a distracted state (e.g. DROWSY, PHONE, LOOKING_AWAY, AWAY)
      if (candidateState === 'STUDYING') {
        // Recovery requires sustained neutral evidence for >= recoveryWindowSec (default 15s)
        if (!this.studyingRecoveryStartTime) {
          this.studyingRecoveryStartTime = now;
        }

        const recoveryDurationSec = (now - this.studyingRecoveryStartTime) / 1000;
        if (recoveryDurationSec >= this.settings.recoveryWindowSec) {
          this.transitionTo('STUDYING', 0.92, `Recovered study focus for ${recoveryDurationSec.toFixed(0)}s`);
          this.studyingRecoveryStartTime = null;
        }
      } else {
        // Reset recovery timer if still distracted
        this.studyingRecoveryStartTime = null;

        // If candidate state changed to another distraction (e.g. looking away -> phone usage)
        if (candidateState !== this.currentState && candidateState !== 'UNKNOWN') {
          this.transitionTo(candidateState, candidateConfidence, candidateReason);
        }
      }
    }

    // 5. Build Status Info
    const recoveryProgress = this.studyingRecoveryStartTime
      ? Math.min(100, Math.round(((now - this.studyingRecoveryStartTime) / 1000 / this.settings.recoveryWindowSec) * 100))
      : 0;

    return {
      ...this.getStatus(candidateConfidence, this.getDisplayLabel(this.currentState), this.getStatusLevel(this.currentState)),
      recoveryProgressPercent: recoveryProgress,
      signals: {
        drowsyEvidenceSec,
        phoneEvidenceSec,
        lookingAwayEvidenceSec,
        awayEvidenceSec,
        movementCount30s,
      },
    };
  }

  private transitionTo(newState: StudyState, confidence: number, reason: string) {
    const prev = this.currentState;
    this.currentState = newState;
    this.stateEnteredAt = Date.now();

    if (this.onStateChange) {
      this.onStateChange({
        previousState: prev,
        newState,
        timestamp: Date.now(),
        confidence,
        reason,
      });
    }
  }

  /**
   * Calculates continuous trailing duration (seconds) where predicate is true
   */
  private calculateSustainedDuration(predicate: (f: RawVisionFrame) => boolean): number {
    if (this.frameHistory.length === 0) return 0;

    let sustainedStart = this.frameHistory[this.frameHistory.length - 1].timestamp;
    let isSustained = true;

    for (let i = this.frameHistory.length - 1; i >= 0; i--) {
      const f = this.frameHistory[i];
      if (predicate(f)) {
        sustainedStart = f.timestamp;
      } else {
        isSustained = false;
        break;
      }
    }

    const latest = this.frameHistory[this.frameHistory.length - 1].timestamp;
    return isSustained || sustainedStart < latest ? Math.max(0, (latest - sustainedStart) / 1000) : 0;
  }

  private getStatus(
    confidence: number,
    displayLabel: string,
    statusLevel: 'focused' | 'mild_drift' | 'distracted' | 'needs_attention' | 'neutral'
  ): StateMachineStatus {
    const now = Date.now();
    const durationMs = now - this.stateEnteredAt;

    return {
      currentState: this.currentState,
      stateConfidence: confidence,
      stateDurationSec: Math.round(durationMs / 1000),
      timeInCurrentStateMs: durationMs,
      recoveryProgressPercent: 0,
      displayLabel,
      statusLevel,
      signals: {
        drowsyEvidenceSec: 0,
        phoneEvidenceSec: 0,
        lookingAwayEvidenceSec: 0,
        awayEvidenceSec: 0,
        movementCount30s: 0,
      },
    };
  }

  private getDisplayLabel(state: StudyState): string {
    switch (state) {
      case 'STUDYING':
        return 'Likely Studying';
      case 'DROWSY':
        return 'Possible Drowsiness';
      case 'PHONE_USAGE':
        return 'Phone Usage Detected';
      case 'LOOKING_AWAY':
        return 'Looking Away';
      case 'AWAY_FROM_DESK':
        return 'Away From Desk';
      case 'EXCESSIVE_MOVEMENT':
        return 'Restless Movement';
      case 'BREAK':
        return 'Scheduled Break';
      case 'UNKNOWN':
        return 'Low Lighting / Obstructed';
      default:
        return 'Evaluating...';
    }
  }

  private getStatusLevel(state: StudyState): 'focused' | 'mild_drift' | 'distracted' | 'needs_attention' | 'neutral' {
    switch (state) {
      case 'STUDYING':
        return 'focused';
      case 'LOOKING_AWAY':
      case 'EXCESSIVE_MOVEMENT':
        return 'mild_drift';
      case 'PHONE_USAGE':
        return 'distracted';
      case 'DROWSY':
      case 'AWAY_FROM_DESK':
        return 'needs_attention';
      case 'BREAK':
      case 'UNKNOWN':
      default:
        return 'neutral';
    }
  }
}
