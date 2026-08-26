import { AppSettings, CalibrationProfile, Achievement, StudyState } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  liteMode: false,
  autoLiteModeOnSlowDevice: true,
  showLandmarkOverlay: false,
  cameraDeviceId: undefined,
  drowsyThresholdSec: 3.5,
  phoneThresholdSec: 4.0,
  lookingAwayThresholdSec: 8.0,
  awayThresholdSec: 5.0,
  excessiveMovementThresholdCount: 3,
  recoveryWindowSec: 15.0,

  earThresholdRatio: 0.72,
  pitchTurnThresholdDeg: 22,
  yawTurnThresholdDeg: 25,

  wDistraction: 1.0,
  wDrowsy: 1.4,
  wPhone: 1.5,
  wAway: 1.2,
  wWarning: 1.5,
  wPostureBonus: 5.0,

  soundEnabled: true,
  soundVolume: 0.7,
  soundTheme: 'zen_bell',
  ttsEnabled: false,
  ttsVolume: 0.8,
  alertCooldownSec: 20.0,

  hasCompletedOnboarding: false,
  autoStartTimerOnStudy: false,

  // AI Claude Defaults
  aiEnabled: true,
  aiApiKey: import.meta.env.VITE_CLAUDE_API_KEY || '',
  aiModel: (import.meta.env.VITE_AI_MODEL as any) || 'claude-3-5-sonnet-20241022',
  aiCoachStyle: (import.meta.env.VITE_AI_COACH_STYLE as any) || 'encouraging',
  aiAutoInsights: true,
};

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  id: 'default_profile',
  createdAt: Date.now(),
  isCalibrated: false,
  neutralEAR: 0.28,
  neutralPitch: 5.0, // slight natural downward gaze towards desk/screen
  neutralYaw: 0.0,
  neutralRoll: 0.0,
  neutralShoulderDistance: 180,
  neutralLighting: 80,
};

export const MESSAGE_POOLS: Record<StudyState, { level1: string[]; level2: string[]; level3: string[] }> = {
  DROWSY: {
    level1: [
      'Eyes seem to be closing — a quick stretch might give you a second wind.',
      'Feeling heavy-eyed? Take a deep breath and adjust your posture.',
      'Slight drowsiness detected — take a quick sip of water.',
    ],
    level2: [
      'Getting sleepy? A brief 2-minute walk or cold splash of water can reboot your focus.',
      'Your eyelids are lingering closed. Stand up and shake out your shoulders.',
      'Energy dropping noticeably — consider taking a scheduled 5-minute break.',
    ],
    level3: [
      'Critical drowsiness: Push through or take a short power nap to recharge your brain effectively.',
      'Sustained eye closure. Step away from the screen for a moment.',
      'High fatigue detected. A restorative break will save your study session.',
    ],
  },
  PHONE_USAGE: {
    level1: [
      "Phone's pulling your focus — try placing it face down out of reach.",
      'That notification can wait until your next break.',
      'Quick phone check? Keep your momentum going.',
    ],
    level2: [
      'Your attention is drifting to your phone. Move it across the room.',
      'Sustained phone activity detected. Return to your study material.',
      'Protect your deep work zone — tuck your phone in a drawer.',
    ],
    level3: [
      'Phone distraction is heavily eating into your study cycle. Lock it down!',
      'Deep work interrupted by screen switching. Put the device away to save your focus score.',
      'Time to reclaim your concentration — phone away now.',
    ],
  },
  LOOKING_AWAY: {
    level1: [
      'Gaze is drifting — bring your attention back to the screen or book.',
      "Let's refocus on the material in front of you.",
      'Mind wandering a bit? Re-anchor on the current paragraph.',
    ],
    level2: [
      'Looking away for a sustained period. Bring your eyes back to your work.',
      'Re-engage with the task at hand — every minute of focused effort counts.',
      'Notice what pulled your gaze away and gently return to studying.',
    ],
    level3: [
      'Extended glance away from workspace. If you need to brainstorm or read offline, tap "Break" or "Pause".',
      'Loss of visual focus for over 20 seconds. Reconnect with your objective.',
      'Distraction detected — align your posture and screen.',
    ],
  },
  DISTRACTED: {
    level1: [
      'Slight distraction detected — gently reset your focus.',
      'Bring your momentum back to your current task.',
      'Anchor your attention back into the zone.',
    ],
    level2: [
      'Attention has slipped for several moments. Let’s get back on track.',
      'Notice any distractions in your surroundings and eliminate them.',
      'Re-center your mind and resume your study flow.',
    ],
    level3: [
      'Prolonged distraction is lowering your focus score. Recommit to your session goal.',
      'Reset your workspace and resume deep work.',
      'Focus alert: Take control of your attention now.',
    ],
  },
  AWAY_FROM_DESK: {
    level1: [
      'You seem to have stepped away. The session will pause if you are gone.',
      'Workspace empty. Tap "Break" if you are stepping out.',
      'Waiting for your return...',
    ],
    level2: [
      'Desk is still unoccupied. Timer is idling.',
      'Still away from your desk. Remember to log your break.',
      'Away from screen for over a minute.',
    ],
    level3: [
      'Extended absence detected. Consider pausing or ending the session to preserve accurate stats.',
      'No person detected at the desk. Session is holding.',
      'Away alert: Tap resume once you return.',
    ],
  },
  EXCESSIVE_MOVEMENT: {
    level1: [
      'Lots of fidgeting or shifting — a short stretch might help more than pushing through.',
      'Restless energy detected. Take 3 deep diaphragmatic breaths.',
      'Adjust your chair or desk height for better ergonomic support.',
    ],
    level2: [
      'Frequent restlessness. Stand up, stretch your back, and settle back in.',
      'Continuous shifting detected. Are you physically comfortable?',
      'If you feel frustrated with the material, take a 60-second breathing pause.',
    ],
    level3: [
      'High agitation or excessive movement. A structured 5-minute movement break is recommended.',
      'Reset your body: step away, hydrate, and return calm.',
      'Physical restlessness is disrupting your focus flow.',
    ],
  },
  STUDYING: {
    level1: ['Great focus! Keep up the good momentum.'],
    level2: ['In the zone — steady and productive.'],
    level3: ['Peak focus streak active!'],
  },
  BREAK: {
    level1: ['Enjoy your break! Rest your eyes and hydrate.'],
    level2: ['Relaxation mode active — camera monitoring is suspended.'],
    level3: ['Break time.'],
  },
  UNKNOWN: {
    level1: ['Camera obstructed or lighting too low to confirm posture.'],
    level2: ['Please check that your face is illuminated and visible in the webcam frame.'],
    level3: ['Lighting or camera alignment needs adjustment.'],
  },
};

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_session',
    key: 'first_session',
    title: 'First Step',
    description: 'Completed your first AI-monitored study session.',
    icon: 'Rocket',
    isUnlocked: false,
    category: 'mastery',
  },
  {
    id: 'pomodoro_master',
    key: 'pomodoro_master',
    title: 'Pomodoro Pro',
    description: 'Completed 4 full Pomodoro focus cycles.',
    icon: 'Timer',
    isUnlocked: false,
    category: 'focus',
  },
  {
    id: 'laser_focus',
    key: 'laser_focus',
    title: 'Laser Focus',
    description: 'Maintained a 90+ Focus Score for an entire 25+ min session.',
    icon: 'Sparkles',
    isUnlocked: false,
    category: 'focus',
  },
  {
    id: 'phone_free',
    key: 'phone_free',
    title: 'Digital Monk',
    description: 'Completed a 50-minute deep work session with zero phone distractions.',
    icon: 'SmartphoneOff',
    isUnlocked: false,
    category: 'focus',
  },
  {
    id: 'posture_king',
    key: 'posture_king',
    title: 'Ergonomic Champion',
    description: 'Averaged 95%+ posture score across a study session.',
    icon: 'ShieldCheck',
    isUnlocked: false,
    category: 'posture',
  },
  {
    id: 'streak_3',
    key: 'streak_3',
    title: '3-Day Flow',
    description: 'Studied for 3 consecutive days.',
    icon: 'Flame',
    isUnlocked: false,
    category: 'streak',
  },
  {
    id: 'streak_7',
    key: 'streak_7',
    title: 'Unstoppable Habit',
    description: 'Maintained a 7-day study streak.',
    icon: 'Trophy',
    isUnlocked: false,
    category: 'streak',
  },
  {
    id: 'night_owl',
    key: 'night_owl',
    title: 'Night Scholar',
    description: 'Completed a study session past 10:00 PM with good focus.',
    icon: 'Moon',
    isUnlocked: false,
    category: 'mastery',
  },
];
