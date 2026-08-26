// ==========================================
// AI Study Monitor — Focus Score Engine
// (Section 6 of Technical Specification)
// ==========================================

import { FocusScoreBreakdown, AppSettings } from '../types';

export class FocusScoreEngine {
  private smoothedScore: number = 100;
  private readonly alpha: number = 0.15; // EMA smoothing factor (0.1 - 0.2)

  constructor(private settings: AppSettings) {}

  updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  reset() {
    this.smoothedScore = 100;
  }

  calculate(
    totalFocusedSec: number,
    totalDistractedSec: number,
    totalDrowsySec: number,
    totalPhoneSec: number,
    totalAwaySec: number,
    warningCount: number,
    averagePostureScore: number = 85
  ): FocusScoreBreakdown {
    // Total active study time excluding breaks
    const activeStudySec = totalFocusedSec + totalDistractedSec + totalDrowsySec + totalPhoneSec + totalAwaySec;
    const sessionMinutes = Math.max(1, activeStudySec / 60);

    const distractionMin = totalDistractedSec / 60;
    const drowsyMin = totalDrowsySec / 60;
    const phoneMin = totalPhoneSec / 60;
    const awayMin = totalAwaySec / 60;

    // Proportional penalties (scaled 0-100)
    const distractionRatio = distractionMin / sessionMinutes;
    const drowsyRatio = drowsyMin / sessionMinutes;
    const phoneRatio = phoneMin / sessionMinutes;
    const awayRatio = awayMin / sessionMinutes;

    const distractionPenalty = Math.min(30, distractionRatio * 100 * (this.settings.wDistraction || 1.0));
    const drowsyPenalty = Math.min(35, drowsyRatio * 100 * (this.settings.wDrowsy || 1.4));
    const phonePenalty = Math.min(40, phoneRatio * 100 * (this.settings.wPhone || 1.5));
    const awayPenalty = Math.min(35, awayRatio * 100 * (this.settings.wAway || 1.2));
    const warningPenalty = Math.min(20, warningCount * (this.settings.wWarning || 1.5));

    // Posture bonus: if posture >= 80%, up to +5 bonus points
    const postureBonus = averagePostureScore >= 80 ? Math.min(5, ((averagePostureScore - 80) / 20) * (this.settings.wPostureBonus || 5.0)) : 0;

    const rawScore = Math.max(
      0,
      Math.min(100, 100 - (distractionPenalty + drowsyPenalty + phonePenalty + awayPenalty + warningPenalty) + postureBonus)
    );

    // Apply Exponential Moving Average (EMA)
    this.smoothedScore = Math.round(this.smoothedScore * (1 - this.alpha) + rawScore * this.alpha);

    return {
      currentScore: Math.round(rawScore),
      smoothedScore: Math.round(this.smoothedScore),
      distractionPenalty: Math.round(distractionPenalty * 10) / 10,
      drowsyPenalty: Math.round(drowsyPenalty * 10) / 10,
      phonePenalty: Math.round(phonePenalty * 10) / 10,
      awayPenalty: Math.round(awayPenalty * 10) / 10,
      warningPenalty: Math.round(warningPenalty * 10) / 10,
      postureBonus: Math.round(postureBonus * 10) / 10,
    };
  }
}
