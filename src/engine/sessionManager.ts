// ==========================================
// AI Study Monitor — Session & Timer Manager
// Handles Pomodoro / Deep Work cycles and time-in-state aggregation
// ==========================================

import { StudySession, SessionPhase, CycleType, StudyState, SessionEvent, EventType } from '../types';
import { db } from '../db';
import { audioEngine } from './audioEngine';

export class SessionManager {
  private currentSession: StudySession | null = null;
  private phase: SessionPhase = 'idle';
  private phaseRemainingSec: number = 0;
  private phaseTotalSec: number = 0;
  private timerInterval: any = null;

  // Real-time tracking accumulator
  private postureScores: number[] = [];

  constructor(
    private onTick?: (session: StudySession, phase: SessionPhase, remainingSec: number) => void,
    private onPhaseChange?: (newPhase: SessionPhase) => void,
    private onSessionComplete?: (session: StudySession) => void
  ) {}

  getCurrentSession(): StudySession | null {
    return this.currentSession;
  }

  getPhase(): SessionPhase {
    return this.phase;
  }

  getRemainingSec(): number {
    return this.phaseRemainingSec;
  }

  startSession(cycleType: CycleType, customStudyMin: number = 25, customBreakMin: number = 5): StudySession {
    this.stopTimer();

    let targetDurationMin = 25;
    let breakDurationMin = 5;

    if (cycleType === 'pomodoro_25_5') {
      targetDurationMin = 25;
      breakDurationMin = 5;
    } else if (cycleType === 'deepwork_50_10') {
      targetDurationMin = 50;
      breakDurationMin = 10;
    } else if (cycleType === 'custom') {
      targetDurationMin = customStudyMin;
      breakDurationMin = customBreakMin;
    } else if (cycleType === 'freeform') {
      targetDurationMin = 0; // unlimited
      breakDurationMin = 5;
    }

    const newSession: StudySession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      startedAt: Date.now(),
      cycleType,
      targetDurationMinutes: targetDurationMin,
      totalFocusedSec: 0,
      totalDistractedSec: 0,
      totalBreakSec: 0,
      totalDrowsySec: 0,
      totalPhoneSec: 0,
      totalLookingAwaySec: 0,
      totalAwaySec: 0,
      finalFocusScore: 100,
      averagePostureScore: 85,
      warningCount: 0,
      overridesUsed: 0,
      completedCycles: 0,
    };

    this.currentSession = newSession;
    this.phase = 'study';
    this.phaseRemainingSec = targetDurationMin > 0 ? targetDurationMin * 60 : 0;
    this.phaseTotalSec = this.phaseRemainingSec;
    this.postureScores = [];

    this.logEvent('studying', 1.0, 0, { action: 'session_started', cycleType });
    this.startTimer(breakDurationMin);

    if (this.onPhaseChange) this.onPhaseChange(this.phase);
    return newSession;
  }

  private startTimer(breakDurationMin: number) {
    this.timerInterval = setInterval(() => {
      if (!this.currentSession || this.phase === 'paused' || this.phase === 'idle') return;

      if (this.phase === 'study') {
        if (this.currentSession.cycleType !== 'freeform') {
          if (this.phaseRemainingSec > 0) {
            this.phaseRemainingSec--;
          } else {
            // Study interval completed -> switch to break
            this.currentSession.completedCycles++;
            this.logEvent('cycle_completed', 1.0, 0, { cycle: this.currentSession.completedCycles });
            audioEngine.playBreakChime(true);
            this.phase = 'short_break';
            this.phaseRemainingSec = breakDurationMin * 60;
            this.phaseTotalSec = this.phaseRemainingSec;
            if (this.onPhaseChange) this.onPhaseChange(this.phase);
          }
        }
      } else if (this.phase === 'short_break' || this.phase === 'long_break') {
        if (this.phaseRemainingSec > 0) {
          this.phaseRemainingSec--;
        } else {
          // Break interval completed -> switch back to study
          audioEngine.playBreakChime(false);
          this.phase = 'study';
          this.phaseRemainingSec = (this.currentSession.targetDurationMinutes || 25) * 60;
          this.phaseTotalSec = this.phaseRemainingSec;
          if (this.onPhaseChange) this.onPhaseChange(this.phase);
        }
      }

      if (this.onTick) {
        this.onTick(this.currentSession, this.phase, this.phaseRemainingSec);
      }
    }, 1000);
  }

  recordSecondState(state: StudyState, postureScore: number = 85, focusScore: number = 100) {
    if (!this.currentSession || this.phase === 'idle') return;

    if (this.phase === 'short_break' || this.phase === 'long_break' || state === 'BREAK') {
      this.currentSession.totalBreakSec++;
      return;
    }

    if (postureScore > 0) {
      this.postureScores.push(postureScore);
      if (this.postureScores.length > 500) this.postureScores.shift();
      const sum = this.postureScores.reduce((a, b) => a + b, 0);
      this.currentSession.averagePostureScore = Math.round(sum / this.postureScores.length);
    }

    switch (state) {
      case 'STUDYING':
        this.currentSession.totalFocusedSec++;
        break;
      case 'DROWSY':
        this.currentSession.totalDrowsySec++;
        this.currentSession.totalDistractedSec++;
        break;
      case 'PHONE_USAGE':
        this.currentSession.totalPhoneSec++;
        this.currentSession.totalDistractedSec++;
        break;
      case 'LOOKING_AWAY':
        this.currentSession.totalLookingAwaySec++;
        this.currentSession.totalDistractedSec++;
        break;
      case 'AWAY_FROM_DESK':
        this.currentSession.totalAwaySec++;
        this.currentSession.totalDistractedSec++;
        break;
      case 'EXCESSIVE_MOVEMENT':
      case 'DISTRACTED':
        this.currentSession.totalDistractedSec++;
        break;
      default:
        break;
    }

    this.currentSession.finalFocusScore = focusScore;
  }

  incrementWarningCount() {
    if (this.currentSession) {
      this.currentSession.warningCount++;
    }
  }

  incrementOverrideCount() {
    if (this.currentSession) {
      this.currentSession.overridesUsed++;
    }
  }

  pauseSession() {
    this.phase = 'paused';
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  resumeSession() {
    this.phase = 'study';
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  async endSession(): Promise<StudySession | null> {
    this.stopTimer();
    if (!this.currentSession) return null;

    const completed = {
      ...this.currentSession,
      endedAt: Date.now(),
    };

    await db.saveSession(completed);
    audioEngine.playSessionCompleteFanfare();

    this.currentSession = null;
    this.phase = 'idle';
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
    if (this.onSessionComplete) this.onSessionComplete(completed);

    return completed;
  }

  async logEvent(type: EventType, confidence: number = 0.9, durationSec: number = 0, meta?: Record<string, any>) {
    if (!this.currentSession) return;
    const evt: SessionEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      type,
      confidence,
      durationSec,
      meta,
    };
    await db.logEvent(evt);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
