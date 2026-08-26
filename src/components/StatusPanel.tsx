import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Sparkles,
  Smartphone,
  PhoneOff,
  UserCheck,
  UserX,
  Clock,
  Eye,
  Activity,
  Flame,
  Coffee,
  Brain,
  Target,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import {
  StudyState,
  FocusScoreBreakdown,
  RawVisionFrame,
  SessionPhase,
  StudySession,
  CycleType,
  SessionGoal,
  AppSettings,
} from '../types';
import { askCoach } from '../services/claudeService';

interface StatusPanelProps {
  currentState: StudyState;
  displayLabel: string;
  confidence: number;
  focusBreakdown: FocusScoreBreakdown;
  latestFrame: RawVisionFrame | null;
  sessionPhase: SessionPhase;
  currentSession: StudySession | null;
  remainingSec: number;
  onStartSession: (cycle: CycleType) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onEndSession: () => void;
  selectedCycle: CycleType;
  currentGoal?: SessionGoal | null;
  onOpenGoalModal?: () => void;
  settings?: AppSettings;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  currentState,
  displayLabel,
  confidence,
  focusBreakdown,
  latestFrame,
  sessionPhase,
  currentSession,
  remainingSec,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onEndSession,
  selectedCycle,
  currentGoal,
  onOpenGoalModal,
  settings,
}) => {
  // AI Coach state
  const [isCoachExpanded, setIsCoachExpanded] = useState(false);
  const [coachInput, setCoachInput] = useState('');
  const [isAskingCoach, setIsAskingCoach] = useState(false);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Quick coaching queries
  const handleAskCoachPrompt = async (promptText: string) => {
    setIsAskingCoach(true);
    setIsCoachExpanded(true);
    try {
      const res = await askCoach(
        promptText,
        currentState,
        focusBreakdown.smoothedScore,
        settings?.aiCoachStyle || 'encouraging',
        settings?.aiModel || 'auto',
        settings?.aiApiKey
      );
      setCoachResponse(res);
    } catch (err: any) {
      setCoachResponse(`Gemini error: ${err.message}`);
    } finally {
      setIsAskingCoach(false);
    }
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachInput.trim()) return;
    const q = coachInput;
    setCoachInput('');
    handleAskCoachPrompt(q);
  };

  // Get status color tokens
  const getStatusVisuals = () => {
    switch (currentState) {
      case 'STUDYING':
        return {
          glow: 'glass-panel-glow-green',
          badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
          icon: Sparkles,
        };
      case 'LOOKING_AWAY':
      case 'EXCESSIVE_MOVEMENT':
        return {
          glow: 'glass-panel-glow-yellow',
          badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          icon: Activity,
        };
      case 'PHONE_USAGE':
        return {
          glow: 'glass-panel-glow-orange',
          badgeBg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
          dot: 'bg-orange-400',
          icon: Smartphone,
        };
      case 'DROWSY':
      case 'AWAY_FROM_DESK':
        return {
          glow: 'glass-panel-glow-red',
          badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
          icon: UserX,
        };
      case 'BREAK':
        return {
          glow: 'glass-panel-glow-green',
          badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-400',
          icon: Coffee,
        };
      default:
        return {
          glow: '',
          badgeBg: 'bg-slate-800/60 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          icon: Sparkles,
        };
    }
  };

  const visuals = getStatusVisuals();
  const isSessionRunning = sessionPhase === 'study' || sessionPhase === 'short_break' || sessionPhase === 'long_break';
  const isBreak = sessionPhase === 'short_break' || sessionPhase === 'long_break';

  return (
    <div className={`w-full glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 flex flex-col justify-between space-y-5 transition-all duration-500 ${visuals.glow}`}>
      {/* Top Status & Live Activity */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Current Activity</span>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${visuals.dot} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${visuals.dot}`}></span>
            </span>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              {displayLabel}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Observable proxy confidence: <span className="font-mono text-slate-200">{Math.round(confidence * 100)}%</span>
          </p>
        </div>

        {/* Phase & Goal Badges */}
        <div className="flex items-center gap-2">
          {onOpenGoalModal && (
            <button
              onClick={onOpenGoalModal}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentGoal?.topic
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 hover:bg-brand-500/30'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{currentGoal?.topic ? currentGoal.topic : 'Set Goal'}</span>
            </button>
          )}

          {isSessionRunning && (
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
              isBreak ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-brand-500/20 text-brand-300 border-brand-500/30'
            }`}>
              {isBreak ? <Coffee className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5 text-brand-400" />}
              <span>{isBreak ? 'Break Interval' : 'Deep Work'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Focus Score */}
        <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Focus Score</span>
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              {focusBreakdown.smoothedScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                focusBreakdown.smoothedScore >= 80
                  ? 'bg-emerald-400'
                  : focusBreakdown.smoothedScore >= 60
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${focusBreakdown.smoothedScore}%` }}
            />
          </div>
        </div>

        {/* 2. Eye Openness */}
        <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Eye Openness</span>
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              {latestFrame?.eyeOpenness ?? 95}%
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              EAR {latestFrame?.ear?.toFixed(2) ?? '0.28'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                (latestFrame?.eyeOpenness ?? 95) > 60
                  ? 'bg-emerald-400'
                  : (latestFrame?.eyeOpenness ?? 95) > 30
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, latestFrame?.eyeOpenness ?? 95)}%` }}
            />
          </div>
        </div>

        {/* 3. Posture & Slouch */}
        <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Posture Quality</span>
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              {latestFrame?.postureScore ?? 88}%
            </span>
            <span className={`text-[11px] font-medium ${latestFrame?.isSlouching ? 'text-amber-400' : 'text-emerald-400'}`}>
              {latestFrame?.isSlouching ? 'Slouch' : 'Aligned'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${latestFrame?.postureScore ?? 88}%` }}
            />
          </div>
        </div>

        {/* 4. Phone Presence */}
        <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Phone Status</span>
            {latestFrame?.phoneDetected ? (
              <Smartphone className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            ) : (
              <PhoneOff className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <div className="my-1.5">
            <span className={`text-base font-display font-bold ${
              latestFrame?.phoneInHand
                ? 'text-rose-400'
                : latestFrame?.phoneDetected
                ? 'text-amber-300'
                : 'text-slate-200'
            }`}>
              {latestFrame?.phoneInHand
                ? 'Phone in Hand'
                : latestFrame?.phoneDetected
                ? 'On Desk'
                : 'Not Detected'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {latestFrame?.phoneDetected
              ? `${Math.round((latestFrame.phoneConfidence || 0) * 100)}% detection`
              : 'Workspace clear'}
          </span>
        </div>
      </div>

      {/* GEMINI AI LIVE STUDY COACH BAR */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand-950/50 via-slate-900/70 to-indigo-950/50 border border-brand-500/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/20 text-brand-300">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                Gemini AI Study Companion
                <span className="px-1.5 py-0.2 rounded bg-brand-500/30 text-brand-200 text-[9px] uppercase font-mono">
                  Active
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAskCoachPrompt('Give me a quick 1-sentence tip to boost my focus right now.')}
              disabled={isAskingCoach}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-brand-300 border border-brand-500/20 transition-all"
            >
              <Zap className="w-3 h-3" />
              <span>Quick Focus Nudge</span>
            </button>

            <button
              onClick={() => setIsCoachExpanded(!isCoachExpanded)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              title="Toggle Ask Coach"
            >
              {isCoachExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick prompt buttons */}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <button
            onClick={() => handleAskCoachPrompt('I feel tired. What is a 60-second exercise to regain alertness?')}
            disabled={isAskingCoach}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 transition-all"
          >
            ⚡ Combat Fatigue
          </button>
          <button
            onClick={() => handleAskCoachPrompt('How can I use active recall to remember what I am studying right now?')}
            disabled={isAskingCoach}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 transition-all"
          >
            🧠 Active Recall Method
          </button>
          <button
            onClick={() => handleAskCoachPrompt('Give me a fast posture alignment checklist for studying at a desk.')}
            disabled={isAskingCoach}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 transition-all"
          >
            🧘 Ergonomic Reset
          </button>
        </div>

        {/* Expandable Coach Chat/Answer */}
        {isCoachExpanded && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            {/* Response Box */}
            {(coachResponse || isAskingCoach) && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-brand-500/30 text-xs space-y-1">
                <div className="flex items-center justify-between text-brand-300 font-semibold text-[10px]">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Gemini's Coaching Advice:
                  </span>
                  {isAskingCoach && <Loader2 className="w-3 h-3 animate-spin text-brand-400" />}
                </div>
                <p className="text-slate-200 leading-relaxed text-[11px]">
                  {isAskingCoach ? 'Gemini is formulating study advice...' : coachResponse}
                </p>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleCustomQuestionSubmit} className="flex gap-2">
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                placeholder="Ask Gemini a study technique or motivation question..."
                className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-500 transition-all"
              />
              <button
                type="submit"
                disabled={isAskingCoach || !coachInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-brand-600/20 transition-all"
              >
                {isAskingCoach ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Ask</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Session Timer & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5">
        {/* Timer Display */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-300">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-2xl text-white tracking-wider">
                {selectedCycle === 'freeform'
                  ? formatTime(currentSession?.totalFocusedSec || 0)
                  : formatTime(remainingSec)}
              </span>
              {currentSession && (
                <span className="text-xs text-slate-400 font-medium">
                  ({currentSession.completedCycles} cycles done)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {sessionPhase === 'idle'
                ? 'Ready to begin session'
                : sessionPhase === 'paused'
                ? 'Session paused'
                : isBreak
                ? 'Break time remaining'
                : 'Focus time remaining'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {sessionPhase === 'idle' ? (
            <button
              onClick={() => onStartSession(selectedCycle)}
              className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Session</span>
            </button>
          ) : sessionPhase === 'paused' ? (
            <>
              <button
                onClick={onResumeSession}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Resume</span>
              </button>
              <button
                onClick={onEndSession}
                className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-sm font-medium transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300" />
                <span>Finish</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onPauseSession}
                className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
              <button
                onClick={onEndSession}
                className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-600/30 text-rose-200 border border-rose-500/40 hover:bg-rose-600/50 text-sm font-medium transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300" />
                <span>Complete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
