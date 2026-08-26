// ==========================================
// AI Study Monitor — Core Type Definitions
// ==========================================

export type StudyState =
  | 'STUDYING'
  | 'DISTRACTED'
  | 'DROWSY'
  | 'PHONE_USAGE'
  | 'LOOKING_AWAY'
  | 'AWAY_FROM_DESK'
  | 'EXCESSIVE_MOVEMENT'
  | 'BREAK'
  | 'UNKNOWN';

export type StateStatusLevel = 'focused' | 'mild_drift' | 'distracted' | 'needs_attention' | 'neutral';

export interface RawVisionFrame {
  timestamp: number;
  // Face & Eye signals
  isFaceDetected: boolean;
  ear: number; // Eye Aspect Ratio
  eyeOpenness: number; // 0 to 100%
  isEyeClosed: boolean;
  headPitch: number; // degrees: -90 (up) to +90 (down)
  headYaw: number; // degrees: -90 (left) to +90 (right)
  headRoll: number; // degrees: -90 (tilt left) to +90 (tilt right)
  isLookingAway: boolean;
  isHeadDropped: boolean;
  gazeX: number; // -1 (left) to +1 (right)
  gazeY: number; // -1 (up) to +1 (down)

  // Pose signals
  isPersonDetected: boolean;
  isSlouching: boolean;
  postureScore: number; // 0 to 100%
  shoulderSlope: number;
  shoulderDistance: number; // normalization proxy for camera distance
  movementMagnitude: number; // frame-to-frame delta

  // Object & Proximity signals
  phoneDetected: boolean;
  phoneConfidence: number;
  phoneBoundingBox?: { x: number; y: number; width: number; height: number };
  phoneInHand: boolean;

  // Environment signals
  lightingScore: number; // 0 to 100%
  lightingCondition: 'good' | 'low' | 'high_glare';
}

export interface CalibrationProfile {
  id: string;
  createdAt: number;
  isCalibrated: boolean;
  neutralEAR: number;
  neutralPitch: number;
  neutralYaw: number;
  neutralRoll: number;
  neutralShoulderDistance: number;
  neutralLighting: number;
}

export type WarningSeverity = 1 | 2 | 3; // 1: Gentle, 2: Direct, 3: Alarm

export interface WarningNotification {
  id: string;
  category: StudyState;
  severity: WarningSeverity;
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  soundPlayed: boolean;
}

export interface FocusScoreBreakdown {
  currentScore: number; // 0 to 100
  smoothedScore: number;
  distractionPenalty: number;
  drowsyPenalty: number;
  phonePenalty: number;
  awayPenalty: number;
  warningPenalty: number;
  postureBonus: number;
}

export type CycleType = 'pomodoro_25_5' | 'deepwork_50_10' | 'custom' | 'freeform';
export type SessionPhase = 'study' | 'short_break' | 'long_break' | 'paused' | 'idle';

export interface StudySession {
  id: string;
  startedAt: number;
  endedAt?: number;
  cycleType: CycleType;
  targetDurationMinutes: number;
  totalFocusedSec: number;
  totalDistractedSec: number;
  totalBreakSec: number;
  totalDrowsySec: number;
  totalPhoneSec: number;
  totalLookingAwaySec: number;
  totalAwaySec: number;
  finalFocusScore: number;
  averagePostureScore: number;
  warningCount: number;
  overridesUsed: number;
  completedCycles: number;
}

export type EventType =
  | 'studying'
  | 'distracted'
  | 'drowsy'
  | 'phone_usage'
  | 'looking_away'
  | 'away_from_desk'
  | 'excessive_movement'
  | 'break'
  | 'warning_triggered'
  | 'alarm_triggered'
  | 'override_used'
  | 'cycle_completed';

export interface SessionEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  type: EventType;
  confidence: number;
  durationSec: number;
  meta?: Record<string, any>;
}

export interface DailyStats {
  id: string;
  date: string; // YYYY-MM-DD
  totalStudySec: number;
  avgFocusScore: number;
  streakDays: number;
  topDistractionType: string;
  sessionsCount: number;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  isUnlocked: boolean;
  category: 'focus' | 'streak' | 'posture' | 'mastery';
}

export interface AppSettings {
  // Vision & Sensitivity
  liteMode: boolean;
  autoLiteModeOnSlowDevice: boolean;
  showLandmarkOverlay: boolean;
  cameraDeviceId?: string;
  drowsyThresholdSec: number; // default 3.5s
  phoneThresholdSec: number; // default 4s
  lookingAwayThresholdSec: number; // default 8s
  awayThresholdSec: number; // default 5s
  excessiveMovementThresholdCount: number; // default 3 events in 30s
  recoveryWindowSec: number; // default 15s

  // Threshold fine-tuning
  earThresholdRatio: number; // 0.75 of calibrated EAR = closed
  pitchTurnThresholdDeg: number; // 22 deg
  yawTurnThresholdDeg: number; // 25 deg

  // Focus Score Weights
  wDistraction: number; // default 1.0
  wDrowsy: number; // default 1.4
  wPhone: number; // default 1.5
  wAway: number; // default 1.2
  wWarning: number; // default 2.0
  wPostureBonus: number; // default 5.0

  // Audio & Alerts
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  soundTheme: 'zen_bell' | 'marimba' | 'soft_synth' | 'digital_pulse';
  ttsEnabled: boolean;
  ttsVolume: number;
  alertCooldownSec: number; // default 20s

  // Privacy & UI
  hasCompletedOnboarding: boolean;
  autoStartTimerOnStudy: boolean;

  // AI Claude Settings
  aiEnabled: boolean;
  aiApiKey: string;
  aiModel: AIModelChoice;
  aiCoachStyle: CoachPersonality;
  aiAutoInsights: boolean; // auto-generate insights after session ends
}

// ==========================================
// AI & Claude Integration Types
// ==========================================

export type AIModelChoice =
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash-lite'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-7-sonnet-20250219'
  | 'claude-3-haiku-20240307'
  | 'auto';

export type CoachPersonality = 'encouraging' | 'strict' | 'socratic';

export interface AIReport {
  id: string;
  sessionId: string;
  generatedAt: number;
  executiveSummary: string;
  distractionAnalysis: string;
  actionSteps: string[];
  productivityArchetype: string;
  archetypeEmoji: string;
  rawMarkdown: string;
}

export interface AICoachTip {
  id: string;
  message: string;
  generatedAt: number;
  context: StudyState;
  isExpanded: boolean;
}

export interface SessionGoal {
  id: string;
  sessionId?: string;
  topic: string;
  notes: string;
  createdAt: number;
  aiSummary?: string;
  aiFlashcards?: string[];
  completionPercent?: number;
}
