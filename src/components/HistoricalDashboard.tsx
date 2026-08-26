import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Trophy,
  Flame,
  Clock,
  Sparkles,
  PhoneOff,
  ShieldCheck,
  Timer,
  Moon,
  Rocket,
  Trash2,
  Download,
  X,
  Calendar,
  Layers,
} from 'lucide-react';
import { StudySession, Achievement, DailyStats } from '../types';

interface HistoricalDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onExportAll: () => void;
  onClearAll: () => void;
}

export const HistoricalDashboard: React.FC<HistoricalDashboardProps> = ({
  isOpen,
  onClose,
  onExportAll,
  onClearAll,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'achievements' | 'trends'>('history');

  const sessions = useLiveQuery(() => db.sessions.reverse().toArray(), []);
  const achievements = useLiveQuery(() => db.achievements.toArray(), []);
  const dailyStats = useLiveQuery(() => db.daily_stats.reverse().toArray(), []);

  if (!isOpen) return null;

  const totalStudyMinutes = sessions ? Math.round(sessions.reduce((acc, s) => acc + s.totalFocusedSec, 0) / 60) : 0;
  const avgOverallScore =
    sessions && sessions.length > 0
      ? Math.round(sessions.reduce((acc, s) => acc + s.finalFocusScore, 0) / sessions.length)
      : 100;
  const streakDays = dailyStats && dailyStats.length > 0 ? dailyStats[0].streakDays : 0;

  const getAchievementIcon = (iconName: string) => {
    switch (iconName) {
      case 'Rocket':
        return Rocket;
      case 'Timer':
        return Timer;
      case 'Sparkles':
        return Sparkles;
      case 'PhoneOff':
      case 'SmartphoneOff':
        return PhoneOff;
      case 'ShieldCheck':
        return ShieldCheck;
      case 'Flame':
        return Flame;
      case 'Trophy':
        return Trophy;
      case 'Moon':
        return Moon;
      default:
        return Sparkles;
    }
  };

  const formatMinSec = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s}s`;
  };

  const deleteSession = async (id: string) => {
    await db.sessions.delete(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-brand-500/30 text-slate-100 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Study Analytics & Habit Tracker</h2>
              <p className="text-xs text-slate-400">Historical performance, streaks, and milestone achievements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Summary Stats */}
        <div className="grid grid-cols-3 gap-3 my-5">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              Total Deep Work
            </span>
            <p className="text-2xl font-display font-bold text-white mt-1">
              {totalStudyMinutes >= 60 ? `${(totalStudyMinutes / 60).toFixed(1)}h` : `${totalStudyMinutes}m`}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Avg Focus Score
            </span>
            <p className="text-2xl font-display font-bold text-emerald-400 mt-1">{avgOverallScore}%</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Active Streak
            </span>
            <p className="text-2xl font-display font-bold text-amber-400 mt-1">{streakDays} Days</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'history'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Past Sessions ({sessions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'achievements'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Achievements ({achievements?.filter((a) => a.isUnlocked).length || 0}/
            {achievements?.length || 8})
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'trends'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Daily Trends
          </button>
        </div>

        {/* TAB 1: Sessions List */}
        {activeTab === 'history' && (
          <div className="space-y-2.5">
            {!sessions || sessions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Layers className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm font-medium">No recorded sessions yet.</p>
                <p className="text-xs text-slate-500 mt-1">Start a study cycle to log your focus history.</p>
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 flex items-center justify-between gap-3 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">
                        {new Date(s.startedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 uppercase font-mono">
                        {s.cycleType.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Focus: <strong className="text-emerald-400">{formatMinSec(s.totalFocusedSec)}</strong> •
                      Distracted: {formatMinSec(s.totalDistractedSec)} • Posture: {s.averagePostureScore}%
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-display font-bold text-emerald-400">{s.finalFocusScore}</span>
                      <span className="text-[11px] text-slate-500 block">/ 100</span>
                    </div>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: Achievements */}
        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements?.map((ach) => {
              const Icon = getAchievementIcon(ach.icon);
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                    ach.isUnlocked
                      ? 'bg-brand-950/40 border-brand-500/40 shadow-lg shadow-brand-500/10'
                      : 'bg-slate-900/30 border-white/5 opacity-60'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      ach.isUnlocked
                        ? 'bg-gradient-to-tr from-brand-600 to-indigo-500 text-white'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">{ach.title}</h4>
                      {ach.isUnlocked && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                          UNLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Daily Trends */}
        {activeTab === 'trends' && (
          <div className="space-y-3">
            {!dailyStats || dailyStats.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No daily aggregates yet. Complete your first study session to start building daily trends!
              </div>
            ) : (
              dailyStats.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-brand-400" />
                    <div>
                      <span className="font-semibold text-white">{d.date}</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{d.sessionsCount} sessions completed</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-slate-400">Total Focus:</span>
                      <p className="font-bold text-emerald-400">{Math.round(d.totalStudySec / 60)} mins</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Avg Score:</span>
                      <p className="font-bold text-white">{d.avgFocusScore}%</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-5 mt-6 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onExportAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All (JSON)</span>
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe History</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-500/25 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
