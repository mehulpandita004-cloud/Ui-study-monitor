import React, { useState } from 'react';
import {
  Target,
  Sparkles,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  X,
  Send,
  Loader2,
  Brain,
  ListTodo,
} from 'lucide-react';
import { SessionGoal, StudySession, AppSettings } from '../types';
import { summarizeSessionGoal } from '../services/claudeService';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: SessionGoal;
  onSaveGoal: (goal: SessionGoal) => void;
  activeSession: StudySession | null;
  settings: AppSettings;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  goal,
  onSaveGoal,
  activeSession,
  settings,
}) => {
  const [topic, setTopic] = useState(goal.topic);
  const [notes, setNotes] = useState(goal.notes);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    flashcards: string[];
    completionPercent: number;
  } | null>(
    goal.aiSummary
      ? {
          summary: goal.aiSummary,
          flashcards: goal.aiFlashcards || [],
          completionPercent: goal.completionPercent || 100,
        }
      : null
  );
  const [revealedCards, setRevealedCards] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveGoal({
      ...goal,
      topic,
      notes,
      aiSummary: summaryData?.summary,
      aiFlashcards: summaryData?.flashcards,
      completionPercent: summaryData?.completionPercent,
    });
    onClose();
  };

  const handleGenerateSummary = async () => {
    if (!activeSession) return;
    setIsSummarizing(true);
    try {
      const res = await summarizeSessionGoal(
        { ...goal, topic, notes },
        activeSession,
        settings.aiCoachStyle,
        settings.aiModel,
        settings.aiApiKey
      );
      setSummaryData(res);
      onSaveGoal({
        ...goal,
        topic,
        notes,
        aiSummary: res.summary,
        aiFlashcards: res.flashcards,
        completionPercent: res.completionPercent,
      });
    } catch (err: any) {
      alert(`AI Summary Error: ${err.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const toggleCard = (index: number) => {
    setRevealedCards((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-brand-500/30 text-slate-100 shadow-2xl overflow-y-auto max-h-[90vh] space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-600/30 border border-brand-500/40 text-brand-300">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Study Goal & Topic Tracker</h2>
              <p className="text-xs text-slate-400">Anchor your session objective for Gemini AI analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-brand-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Target Topic or Task
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Organic Chemistry Reaction Mechanisms, LeetCode Dynamic Programming..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5" />
              Session Notes / Sub-Goals (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key concepts to cover, chapter sections, formulas to memorize, or reflections..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-4 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-brand-500 resize-none transition-all"
            />
          </div>
        </div>

        {/* AI Summarizer Trigger */}
        {activeSession && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-950/40 via-slate-900/60 to-indigo-950/40 border border-brand-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand-400" />
                <h4 className="text-xs font-semibold text-white">Gemini AI Goal Summarizer</h4>
              </div>
              <button
                onClick={handleGenerateSummary}
                disabled={isSummarizing || !topic.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md shadow-brand-600/20"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{summaryData ? 'Re-Analyze Session' : 'Summarize with Gemini'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated AI Summary & Flashcards */}
            {summaryData && (
              <div className="space-y-3 pt-2 text-xs">
                {/* Summary Box */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">Session Outcome</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                      {summaryData.completionPercent}% Goal Completion
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{summaryData.summary}</p>
                </div>

                {/* Flashcards */}
                {summaryData.flashcards.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] text-brand-300 font-semibold uppercase tracking-wider block">
                      Generated Retention Flashcards ({summaryData.flashcards.length})
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {summaryData.flashcards.map((card, idx) => {
                        const isRevealed = !!revealedCards[idx];
                        const parts = card.includes('|') ? card.split('|') : [card, ''];
                        const question = parts[0].replace(/^Q:\s*/i, '').trim();
                        const answer = (parts[1] || '').replace(/^A:\s*/i, '').trim();

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleCard(idx)}
                            className="p-3 rounded-xl bg-slate-900/90 border border-brand-500/20 hover:border-brand-500/40 cursor-pointer transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-slate-300 font-medium">
                              <span className="flex items-center gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-brand-400" />
                                {question}
                              </span>
                              <span className="text-[10px] text-brand-400 font-mono">
                                {isRevealed ? 'Hide Answer' : 'Click to Reveal'}
                              </span>
                            </div>
                            {isRevealed && answer && (
                              <p className="text-[11px] text-emerald-300 pt-1 border-t border-white/5 pl-5 animate-fadeIn">
                                💡 {answer}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/25 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Topic & Goal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
