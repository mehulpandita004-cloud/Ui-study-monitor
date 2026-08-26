import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  Clock,
  Smartphone,
  Eye,
  Download,
  Trash2,
  X,
  CheckCircle2,
  Brain,
  Lightbulb,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { StudySession, FocusScoreBreakdown, AIReport, AppSettings } from '../types';
import { generatePostSessionInsights } from '../services/claudeService';

interface PostSessionModalProps {
  session: StudySession | null;
  onClose: () => void;
  onDeleteSession: (sessionId: string) => void;
  focusBreakdown?: FocusScoreBreakdown | null;
  settings?: AppSettings;
}

export const PostSessionModal: React.FC<PostSessionModalProps> = ({
  session,
  onClose,
  onDeleteSession,
  focusBreakdown,
  settings,
}) => {
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (session && session.finalFocusScore >= 75) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#10B981', '#38BDF8', '#F59E0B'],
      });
    }
  }, [session]);

  // Automatically or manually generate Claude AI Insights
  const fetchAiInsights = async () => {
    if (!session) return;
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const report = await generatePostSessionInsights(
        session,
        focusBreakdown || null,
        settings?.aiCoachStyle || 'encouraging',
        settings?.aiModel || 'auto',
        settings?.aiApiKey
      );
      setAiReport(report);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate Claude AI report.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  useEffect(() => {
    if (session && settings?.aiEnabled && settings?.aiAutoInsights && !aiReport) {
      fetchAiInsights();
    }
  }, [session]);

  if (!session) return null;

  const formatMinSec = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    if (mins === 0) return `${s}s`;
    return `${mins}m ${s}s`;
  };

  const totalActiveSec =
    session.totalFocusedSec +
    session.totalDistractedSec +
    session.totalDrowsySec +
    session.totalPhoneSec +
    session.totalAwaySec;

  const focusRatio = totalActiveSec > 0 ? Math.round((session.totalFocusedSec / totalActiveSec) * 100) : 100;

  const exportJSON = () => {
    const exportData = {
      ...session,
      aiReport,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `study_session_${session.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCSV = () => {
    const headers = 'ID,StartedAt,EndedAt,CycleType,FocusedSec,DistractedSec,DrowsySec,PhoneSec,AwaySec,BreakSec,FinalFocusScore,PostureScore,Warnings,Archetype\n';
    const row = `${session.id},${new Date(session.startedAt).toISOString()},${session.endedAt ? new Date(session.endedAt).toISOString() : ''},${session.cycleType},${session.totalFocusedSec},${session.totalDistractedSec},${session.totalDrowsySec},${session.totalPhoneSec},${session.totalAwaySec},${session.totalBreakSec},${session.finalFocusScore},${session.averagePostureScore},${session.warningCount},"${aiReport?.productivityArchetype || 'N/A'}"\n`;
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + row);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `study_session_${session.id}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-brand-500/30 text-slate-100 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-600/30 border border-brand-500/40 text-brand-300">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Study Session Complete!</h2>
              <p className="text-xs text-slate-400">
                {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                {session.cycleType.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Score Card */}
        <div className="my-6 p-6 rounded-3xl bg-gradient-to-r from-brand-950/60 via-slate-900/80 to-indigo-950/60 border border-brand-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <span className="text-xs font-semibold text-brand-300 uppercase tracking-widest">
              Session Focus Score
            </span>
            <div className="flex items-baseline justify-center sm:justify-start gap-2 mt-1">
              <span className="text-5xl font-display font-extrabold text-white tracking-tight">
                {session.finalFocusScore}
              </span>
              <span className="text-sm text-slate-400">/ 100</span>
            </div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center justify-center sm:justify-start gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{focusRatio}% of active study time was in deep focus</span>
            </p>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/5">
              <span className="text-[11px] text-slate-400">Deep Focus</span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatMinSec(session.totalFocusedSec)}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/5">
              <span className="text-[11px] text-slate-400">Posture Avg</span>
              <p className="text-lg font-bold text-cyan-400 mt-0.5">{session.averagePostureScore}%</p>
            </div>
          </div>
        </div>

        {/* Time Distribution Breakdown */}
        <div className="space-y-3 mb-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Time Distribution Breakdown
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Focused
              </span>
              <p className="text-base font-bold text-white mt-1">{formatMinSec(session.totalFocusedSec)}</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-orange-400" />
                Phone Interruption
              </span>
              <p className="text-base font-bold text-orange-300 mt-1">{formatMinSec(session.totalPhoneSec)}</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-400" />
                Looking Away
              </span>
              <p className="text-base font-bold text-amber-300 mt-1">{formatMinSec(session.totalLookingAwaySec)}</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                Break Time
              </span>
              <p className="text-base font-bold text-blue-300 mt-1">{formatMinSec(session.totalBreakSec)}</p>
            </div>
          </div>
        </div>

        {/* GEMINI AI COACH REPORT CARD */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-brand-950/80 via-slate-900/90 to-indigo-950/80 border border-brand-500/40 shadow-xl mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Gemini AI Study Coach Report
                  {aiReport && (
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-medium border border-brand-500/30 flex items-center gap-1">
                      <span>{aiReport.archetypeEmoji}</span>
                      <span>{aiReport.productivityArchetype}</span>
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">Intelligent focus habits diagnosis & actionable hacks</p>
              </div>
            </div>

            <button
              onClick={fetchAiInsights}
              disabled={isLoadingAi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 text-xs font-medium border border-white/10 transition-all"
            >
              {isLoadingAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{aiReport ? 'Re-Analyze' : 'Generate AI Coach'}</span>
                </>
              )}
            </button>
          </div>

          {/* Loading state */}
          {isLoadingAi && (
            <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
              <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
              <p className="text-xs text-slate-300 font-medium">Gemini is analyzing your gaze, posture, and distraction signals...</p>
            </div>
          )}

          {/* Error state */}
          {aiError && !isLoadingAi && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>AI Insights Notice</span>
              </div>
              <p>{aiError}</p>
            </div>
          )}

          {/* Report Content */}
          {aiReport && !isLoadingAi && (
            <div className="space-y-3.5 text-xs">
              {/* Executive Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/5 space-y-1">
                <span className="text-[10px] font-semibold text-brand-300 uppercase tracking-wider block">
                  Executive Evaluation
                </span>
                <p className="text-slate-200 leading-relaxed">{aiReport.executiveSummary}</p>
              </div>

              {/* Distraction Analysis */}
              {aiReport.distractionAnalysis && (
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/5 space-y-1">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                    Distraction Pattern Diagnosis
                  </span>
                  <p className="text-slate-300 leading-relaxed">{aiReport.distractionAnalysis}</p>
                </div>
              )}

              {/* Action Steps */}
              {aiReport.actionSteps.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    3 Custom Focus Hacks for Next Session
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {aiReport.actionSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5 flex items-start gap-2.5 text-slate-200"
                      >
                        <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-snug">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nudges & Interventions summary */}
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 mb-6 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-300 font-semibold">Gentle Coaching Interventions:</span>
            <p className="text-slate-400 mt-0.5">
              {session.warningCount === 0
                ? 'Zero interruptions needed! Outstanding focus flow.'
                : `${session.warningCount} gentle focus reminders triggered.`}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 font-mono">
            {session.overridesUsed} manual overrides used
          </span>
        </div>

        {/* Bottom Actions: Export & Delete */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDeleteSession(session.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all"
              title="Delete this session from local database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Session</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/25 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
