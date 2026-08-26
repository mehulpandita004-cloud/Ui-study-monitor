// ==========================================
// AI Study Monitor — Warning Engine
// (Section 5 of Technical Specification)
// ==========================================

import { StudyState, WarningSeverity, WarningNotification, AppSettings } from '../types';
import { MESSAGE_POOLS } from '../utils/constants';
import { audioEngine } from './audioEngine';

export class WarningEngine {
  private lastAlertTimestamp: number = 0;
  private categorySeverity: Map<StudyState, WarningSeverity> = new Map();
  private lastMessageIndex: Map<string, number> = new Map(); // category+level -> index
  private consecutiveWarningCounts: Map<StudyState, number> = new Map();
  private lastWarningTriggerTime: Map<StudyState, number> = new Map();

  constructor(
    private settings: AppSettings,
    private onWarning?: (notification: WarningNotification) => void
  ) {}

  updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  resetAllSeverities() {
    this.categorySeverity.clear();
    this.consecutiveWarningCounts.clear();
  }

  resetCategory(category: StudyState) {
    this.categorySeverity.delete(category);
    this.consecutiveWarningCounts.delete(category);
  }

  /**
   * Called periodically by the main loop with the current state machine status.
   */
  evaluateState(
    currentState: StudyState,
    stateDurationSec: number,
    isBreak: boolean
  ): WarningNotification | null {
    // 1. Suppress all alerts if in BREAK state or STUDYING / UNKNOWN
    if (isBreak || currentState === 'BREAK' || currentState === 'STUDYING' || currentState === 'UNKNOWN') {
      return null;
    }

    const now = Date.now();
    const cooldownMs = (this.settings.alertCooldownSec ?? 20) * 1000;

    // 2. Enforce global cooldown across all alerts
    if (now - this.lastAlertTimestamp < cooldownMs) {
      return null;
    }

    // 3. Determine severity based on repetition of THIS specific category
    const currentSeverity = this.categorySeverity.get(currentState) || 1;
    const warningCount = (this.consecutiveWarningCounts.get(currentState) || 0) + 1;

    let targetSeverity: WarningSeverity = 1;
    if (warningCount >= 3) {
      targetSeverity = 3;
    } else if (warningCount >= 2) {
      targetSeverity = 2;
    } else {
      targetSeverity = 1;
    }

    // 4. Select non-repeating message from the pool
    const message = this.getNextMessage(currentState, targetSeverity);
    const title = this.getWarningTitle(currentState, targetSeverity);

    const notification: WarningNotification = {
      id: `warn_${now}_${Math.random().toString(36).substr(2, 4)}`,
      category: currentState,
      severity: targetSeverity,
      title,
      message,
      timestamp: now,
      dismissed: false,
      soundPlayed: this.settings.soundEnabled,
    };

    // 5. Play audio or TTS if enabled
    if (this.settings.soundEnabled) {
      audioEngine.playWarningChime(targetSeverity, this.settings.soundVolume, this.settings.soundTheme);
    }
    if (this.settings.ttsEnabled && targetSeverity >= 2) {
      audioEngine.speakText(message, this.settings.ttsVolume);
    }

    // 6. Update tracking state
    this.lastAlertTimestamp = now;
    this.lastWarningTriggerTime.set(currentState, now);
    this.consecutiveWarningCounts.set(currentState, warningCount);
    this.categorySeverity.set(currentState, targetSeverity);

    if (this.onWarning) {
      this.onWarning(notification);
    }

    return notification;
  }

  private getNextMessage(state: StudyState, severity: WarningSeverity): string {
    const pool = MESSAGE_POOLS[state];
    if (!pool) return 'Please refocus on your study material.';

    let messageList: string[];
    if (severity === 1) messageList = pool.level1;
    else if (severity === 2) messageList = pool.level2;
    else messageList = pool.level3;

    if (!messageList || messageList.length === 0) return 'Gently refocusing...';

    const poolKey = `${state}_lvl${severity}`;
    const lastIndex = this.lastMessageIndex.get(poolKey) ?? -1;

    let nextIndex = (lastIndex + 1) % messageList.length;
    if (messageList.length > 1 && nextIndex === lastIndex) {
      nextIndex = (nextIndex + 1) % messageList.length;
    }

    this.lastMessageIndex.set(poolKey, nextIndex);
    return messageList[nextIndex];
  }

  private getWarningTitle(state: StudyState, severity: WarningSeverity): string {
    const levelLabel = severity === 1 ? 'Focus Coach' : severity === 2 ? 'Attention Check' : 'Focus Alert';
    switch (state) {
      case 'DROWSY':
        return `${levelLabel} — Drowsiness`;
      case 'PHONE_USAGE':
        return `${levelLabel} — Phone Usage`;
      case 'LOOKING_AWAY':
        return `${levelLabel} — Gaze Shift`;
      case 'AWAY_FROM_DESK':
        return `${levelLabel} — Away from Desk`;
      case 'EXCESSIVE_MOVEMENT':
        return `${levelLabel} — High Restlessness`;
      default:
        return `${levelLabel}`;
    }
  }
}
