import React from 'react';
import { ShieldCheck, Eye, Lock, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-brand-500/30 text-slate-100 shadow-2xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600/30 border border-brand-400/40 text-brand-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Welcome to AI Study Monitor
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Your private, on-device focus coach & ergonomic companion.
            </p>
          </div>
        </div>

        {/* Privacy First Pillars */}
        <div className="space-y-3.5 my-6">
          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">100% On-Device & Zero Cloud Streaming</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Your webcam feed is processed directly inside your browser using client-side AI. No video, images, or audio are ever recorded or transmitted.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 mt-0.5">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Transparent Observable Proxies</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                We measure observable physical signals (eyelid closure, head rotation, shoulder posture, phone presence) — never guessing internal emotions or intent.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">You Are in Full Control</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Take breaks or pause monitoring with 1 tap at any time. Dismiss or give feedback on false alerts, and export or wipe your local session data whenever you want.
              </p>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="p-3 rounded-2xl bg-brand-950/40 border border-brand-800/40 mb-6 flex items-center justify-between text-xs text-brand-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Next Step: <strong>10-Second Baseline Calibration</strong></span>
          </div>
          <span className="text-[11px] text-slate-400">Step 1 of 2</span>
        </div>

        {/* CTA Button */}
        <button
          onClick={onComplete}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-500 to-brand-500 text-white font-semibold shadow-lg shadow-brand-500/30 hover:brightness-110 active:scale-[0.99] transition-all"
        >
          <span>Grant Camera Access & Calibrate</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
