import React, { useState } from 'react';
import { Coffee, EyeOff, ThumbsDown, Check, Clock } from 'lucide-react';
import { StudyState } from '../types';

interface ManualOverridesBarProps {
  isBreakOverride: boolean;
  onToggleBreakOverride: () => void;
  isMonitoringPaused: boolean;
  remainingPauseSec: number;
  onPauseMonitoring: (minutes: number) => void;
  onLogFalsePositive: (reportedState: StudyState, reason?: string) => void;
  currentState: StudyState;
}

export const ManualOverridesBar: React.FC<ManualOverridesBarProps> = ({
  isBreakOverride,
  onToggleBreakOverride,
  isMonitoringPaused,
  remainingPauseSec,
  onPauseMonitoring,
  onLogFalsePositive,
  currentState,
}) => {
  const [showPauseDropdown, setShowPauseDropdown] = useState<boolean>(false);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);

  const handleFalseAlarm = () => {
    onLogFalsePositive(currentState, 'User reported false detection button');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const formatRemaining = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Manual Controls:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 1. "I'm on a break" Toggle */}
        <button
          onClick={onToggleBreakOverride}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
            isBreakOverride
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40'
              : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>{isBreakOverride ? 'On Break (Alerts Suspended)' : "I'm on a Break"}</span>
        </button>

        {/* 2. "Stop Watching" (Temporary Pause) */}
        <div className="relative">
          {isMonitoringPaused ? (
            <button
              onClick={() => onPauseMonitoring(0)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium hover:bg-amber-500/30 transition-all"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Resume Vision ({formatRemaining(remainingPauseSec)})</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowPauseDropdown(!showPauseDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 font-medium transition-all"
              >
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Stop Watching...</span>
              </button>

              {showPauseDropdown && (
                <div className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-30 space-y-1">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Pause Vision Inference
                  </div>
                  <button
                    onClick={() => {
                      onPauseMonitoring(5);
                      setShowPauseDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-brand-600 hover:text-white transition-all flex items-center justify-between"
                  >
                    <span>Pause 5 minutes</span>
                    <Clock className="w-3 h-3 opacity-60" />
                  </button>
                  <button
                    onClick={() => {
                      onPauseMonitoring(10);
                      setShowPauseDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-brand-600 hover:text-white transition-all flex items-center justify-between"
                  >
                    <span>Pause 10 minutes</span>
                    <Clock className="w-3 h-3 opacity-60" />
                  </button>
                  <button
                    onClick={() => {
                      onPauseMonitoring(30);
                      setShowPauseDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-brand-600 hover:text-white transition-all flex items-center justify-between"
                  >
                    <span>Pause 30 minutes</span>
                    <Clock className="w-3 h-3 opacity-60" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. "Not me / False detection" Feedback button */}
        <button
          onClick={handleFalseAlarm}
          disabled={feedbackSent}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium border transition-all ${
            feedbackSent
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/10'
          }`}
          title="Log false positive feedback for threshold sensitivity tuning"
        >
          {feedbackSent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ThumbsDown className="w-3.5 h-3.5" />}
          <span>{feedbackSent ? 'Feedback Logged' : 'False Detection'}</span>
        </button>
      </div>
    </div>
  );
};
