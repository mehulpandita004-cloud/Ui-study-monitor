import Dexie, { Table } from 'dexie';
import { StudySession, SessionEvent, DailyStats, Achievement, CalibrationProfile, AppSettings } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION, INITIAL_ACHIEVEMENTS } from '../utils/constants';

export interface UserRecord {
  id: string;
  settings: AppSettings;
  createdAt: number;
}

export interface FalsePositiveLog {
  id: string;
  timestamp: number;
  sessionId?: string;
  state: string;
  severity: number;
  reason?: string;
}

export class StudyMonitorDatabase extends Dexie {
  users!: Table<UserRecord, string>;
  calibration!: Table<CalibrationProfile, string>;
  sessions!: Table<StudySession, string>;
  events!: Table<SessionEvent, string>;
  daily_stats!: Table<DailyStats, string>;
  achievements!: Table<Achievement, string>;
  false_positives!: Table<FalsePositiveLog, string>;

  constructor() {
    super('AIStudyMonitorDB');

    this.version(1).stores({
      users: 'id',
      calibration: 'id',
      sessions: 'id, startedAt, endedAt, finalFocusScore',
      events: 'id, sessionId, timestamp, type',
      daily_stats: 'id, date, streakDays',
      achievements: 'id, key, isUnlocked, category',
      false_positives: 'id, timestamp, state',
    });
  }

  async initializeDefaults() {
    const user = await this.users.get('current_user');
    if (!user) {
      await this.users.put({
        id: 'current_user',
        settings: DEFAULT_SETTINGS,
        createdAt: Date.now(),
      });
    }

    const calib = await this.calibration.get('default_profile');
    if (!calib) {
      await this.calibration.put(DEFAULT_CALIBRATION);
    }

    const achCount = await this.achievements.count();
    if (achCount === 0) {
      await this.achievements.bulkPut(INITIAL_ACHIEVEMENTS);
    }
  }

  async getSettings(): Promise<AppSettings> {
    const user = await this.users.get('current_user');
    return user?.settings || DEFAULT_SETTINGS;
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    await this.users.put({
      id: 'current_user',
      settings: updated,
      createdAt: Date.now(),
    });
    return updated;
  }

  async getCalibration(): Promise<CalibrationProfile> {
    const calib = await this.calibration.get('default_profile');
    return calib || DEFAULT_CALIBRATION;
  }

  async saveCalibration(profile: CalibrationProfile): Promise<void> {
    await this.calibration.put(profile);
  }

  async logEvent(event: SessionEvent): Promise<void> {
    await this.events.put(event);
  }

  async logFalsePositive(log: FalsePositiveLog): Promise<void> {
    await this.false_positives.put(log);
  }

  async saveSession(session: StudySession): Promise<void> {
    await this.sessions.put(session);
    await this.updateDailyStatsForSession(session);
  }

  private async updateDailyStatsForSession(session: StudySession): Promise<void> {
    const today = new Date(session.startedAt).toISOString().split('T')[0];
    const existing = await this.daily_stats.get(today);

    // Calculate streak
    let streak = 1;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayStats = await this.daily_stats.get(yesterday);
    if (yesterdayStats) {
      streak = yesterdayStats.streakDays + 1;
    } else if (existing) {
      streak = existing.streakDays;
    }

    const totalStudySec = (existing?.totalStudySec || 0) + session.totalFocusedSec;
    const sessionsCount = (existing?.sessionsCount || 0) + 1;
    const avgFocusScore = Math.round(
      ((existing?.avgFocusScore || 0) * (sessionsCount - 1) + session.finalFocusScore) / sessionsCount
    );

    // Identify top distraction
    const distractions = [
      { type: 'Phone', sec: session.totalPhoneSec },
      { type: 'Drowsiness', sec: session.totalDrowsySec },
      { type: 'Looking Away', sec: session.totalLookingAwaySec },
      { type: 'Absence', sec: session.totalAwaySec },
    ];
    distractions.sort((a, b) => b.sec - a.sec);
    const topDistractionType = distractions[0].sec > 0 ? distractions[0].type : 'None';

    await this.daily_stats.put({
      id: today,
      date: today,
      totalStudySec,
      avgFocusScore,
      streakDays: streak,
      topDistractionType,
      sessionsCount,
    });
  }

  async exportAllDataAsJSON(): Promise<string> {
    const users = await this.users.toArray();
    const calibration = await this.calibration.toArray();
    const sessions = await this.sessions.toArray();
    const events = await this.events.toArray();
    const dailyStats = await this.daily_stats.toArray();
    const achievements = await this.achievements.toArray();
    const falsePositives = await this.false_positives.toArray();

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        users,
        calibration,
        sessions,
        events,
        dailyStats,
        achievements,
        falsePositives,
      },
      null,
      2
    );
  }

  async clearAllData(): Promise<void> {
    await this.sessions.clear();
    await this.events.clear();
    await this.daily_stats.clear();
    await this.false_positives.clear();
    await this.achievements.clear();
    await this.achievements.bulkPut(INITIAL_ACHIEVEMENTS);
  }
}

export const db = new StudyMonitorDatabase();
db.initializeDefaults();
