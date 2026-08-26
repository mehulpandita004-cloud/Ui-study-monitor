import React, { useState, useEffect, useRef } from 'react';
import { Sliders, CheckCircle2, RotateCcw, Sparkles, UserCheck } from 'lucide-react';
import { CalibrationProfile, RawVisionFrame } from '../types';

interface CalibrationModalProps {
  isOpen: boolean;
  onSaveCalibration: (profile: CalibrationProfile) => void;
  onCancel: () => void;
  latestFrame: RawVisionFrame | null;
  videoElement: HTMLVideoElement | null;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onSaveCalibration,
  onCancel,
  latestFrame,
  videoElement,
}) => {
  const [stage, setStage] = useState<'intro' | 'calibrating' | 'completed'>('intro');
  const [countdown, setCountdown] = useState<number>(10);
  const samplesRef = useRef<RawVisionFrame[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setStage('intro');
      setCountdown(10);
      samplesRef.current = [];
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen]);

  // Collect frames during calibration
  useEffect(() => {
    if (stage === 'calibrating' && latestFrame && latestFrame.isFaceDetected) {
      samplesRef.current.push(latestFrame);
    }
  }, [stage, latestFrame]);

  const startCalibration = () => {
    setStage('calibrating');
    setCountdown(10);
    samplesRef.current = [];

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          finishCalibration();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishCalibration = () => {
    const samples = samplesRef.current;
    if (samples.length === 0) {
      // Fallback to default if no face was captured
      const fallback: CalibrationProfile = {
        id: 'default_profile',
        createdAt: Date.now(),
        isCalibrated: true,
        neutralEAR: 0.28,
        neutralPitch: 5.0,
        neutralYaw: 0.0,
        neutralRoll: 0.0,
        neutralShoulderDistance: 180,
        neutralLighting: 80,
      };
      onSaveCalibration(fallback);
      setStage('completed');
      return;
    }

    // Compute averages
    const avgEAR = samples.reduce((acc, f) => acc + f.ear, 0) / samples.length;
    const avgPitch = samples.reduce((acc, f) => acc + f.headPitch, 0) / samples.length;
    const avgYaw = samples.reduce((acc, f) => acc + f.headYaw, 0) / samples.length;
    const avgRoll = samples.reduce((acc, f) => acc + f.headRoll, 0) / samples.length;
    const avgShoulderDist = samples.reduce((acc, f) => acc + f.shoulderDistance, 0) / samples.length;
    const avgLighting = samples.reduce((acc, f) => acc + f.lightingScore, 0) / samples.length;

    const profile: CalibrationProfile = {
      id: 'default_profile',
      createdAt: Date.now(),
      isCalibrated: true,
      neutralEAR: Math.round(avgEAR * 1000) / 1000,
      neutralPitch: Math.round(avgPitch * 10) / 10,
      neutralYaw: Math.round(avgYaw * 10) / 10,
      neutralRoll: Math.round(avgRoll * 10) / 10,
      neutralShoulderDistance: Math.round(avgShoulderDist),
      neutralLighting: Math.round(avgLighting),
    };

    onSaveCalibration(profile);
    setStage('completed');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-brand-500/30 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600/30 border border-brand-400/40 text-brand-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-white">Posture & Baseline Calibration</h2>
              <p className="text-xs text-slate-400">Capturing your natural studying gaze and ergonomics</p>
            </div>
          </div>
        </div>

        {stage === 'intro' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 space-y-2.5 leading-relaxed">
              <p className="font-semibold text-white">How to calibrate:</p>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-600/40 text-brand-300 flex items-center justify-center text-[11px] font-bold">1</span>
                <span>Sit naturally in your normal study posture (looking at your desk or screen).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-600/40 text-brand-300 flex items-center justify-center text-[11px] font-bold">2</span>
                <span>Keep your face centered and well-lit.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-600/40 text-brand-300 flex items-center justify-center text-[11px] font-bold">3</span>
                <span>Hold steady for 10 seconds while the system captures your personal baseline.</span>
              </div>
            </div>

            {/* Live Camera Pre-check */}
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${latestFrame?.isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-slate-300">
                  {latestFrame?.isFaceDetected ? 'Face Detected & Ready' : 'Looking for face in webcam frame...'}
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                EAR: {latestFrame?.ear?.toFixed(2) || '0.28'}
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all"
              >
                Use Default Baseline
              </button>
              <button
                onClick={startCalibration}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start 10s Calibration</span>
              </button>
            </div>
          </div>
        )}

        {stage === 'calibrating' && (
          <div className="text-center py-6 space-y-5">
            {/* Visual reticle */}
            <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-brand-500/20 animate-pulse-slow" />
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-brand-400/50 animate-spin" style={{ animationDuration: '12s' }} />
              <div className="flex flex-col items-center justify-center">
                <span className="text-4xl font-display font-extrabold text-white tracking-tight">{countdown}</span>
                <span className="text-[11px] text-brand-300 uppercase tracking-widest font-semibold mt-1">Seconds</span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Hold your natural study position...</h3>
              <p className="text-xs text-slate-400">
                Recording {samplesRef.current.length} reference frames
              </p>
            </div>

            {/* Live telemetry snippet */}
            <div className="grid grid-cols-3 gap-2 text-left bg-slate-900/60 p-3 rounded-xl border border-white/5 text-[11px]">
              <div>
                <span className="text-slate-400">Gaze Pitch:</span>
                <p className="font-mono text-white font-medium">{latestFrame?.headPitch || 0}°</p>
              </div>
              <div>
                <span className="text-slate-400">Eye Openness:</span>
                <p className="font-mono text-emerald-400 font-medium">{latestFrame?.eyeOpenness || 95}%</p>
              </div>
              <div>
                <span className="text-slate-400">Lighting:</span>
                <p className="font-mono text-amber-300 font-medium">{latestFrame?.lightingScore || 85}%</p>
              </div>
            </div>
          </div>
        )}

        {stage === 'completed' && (
          <div className="text-center py-5 space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-display font-bold text-white">Baseline Calibrated Successfully!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your personal posture, eye openness, and camera angle have been calibrated.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={startCalibration}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-calibrate</span>
              </button>
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Ready to Study</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
