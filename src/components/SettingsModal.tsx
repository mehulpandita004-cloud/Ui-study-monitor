import React, { useState } from 'react';
import {
  Sliders,
  Volume2,
  ShieldCheck,
  Zap,
  RotateCcw,
  Download,
  Trash2,
  X,
  Play,
  Brain,
  Key,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { AppSettings, CalibrationProfile, AIModelChoice, CoachPersonality } from '../types';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { audioEngine } from '../engine/audioEngine';
import { testApiConnection } from '../services/claudeService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  calibration: CalibrationProfile;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onResetDefaults: () => void;
  onOpenCalibration: () => void;
  onExportAll: () => void;
  onClearAll: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  calibration,
  onUpdateSettings,
  onResetDefaults,
  onOpenCalibration,
  onExportAll,
  onClearAll,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean;
    message: string;
    modelUsed: string;
  } | null>(null);

  if (!isOpen) return null;

  const testAudio = () => {
    audioEngine.playWarningChime(2, settings.soundVolume, settings.soundTheme);
    if (settings.ttsEnabled) {
      audioEngine.speakText('This is a test coaching nudge.', settings.ttsVolume);
    }
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await testApiConnection(settings.aiApiKey, settings.aiModel);
      setApiTestResult(res);
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: err.message || 'Connection test failed',
        modelUsed: settings.aiModel,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-brand-500/30 text-slate-100 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-600/30 border border-brand-500/40 text-brand-300">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Settings & Sensitivities</h2>
              <p className="text-xs text-slate-400">Customize Gemini AI coach, detection thresholds, audio nudges, and privacy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 my-6 text-xs">
          {/* SECTION 1: Gemini AI & Intelligence Engine */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-brand-950/70 via-slate-900/80 to-indigo-950/70 border border-brand-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/20 text-brand-300">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Gemini AI Study Coach & Engine</h3>
                  <p className="text-[10px] text-slate-400">Google Gemini powered post-session insights, live nudges, and goal analysis</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.aiEnabled}
                  onChange={(e) => onUpdateSettings({ aiEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
              </label>
            </div>

            {settings.aiEnabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                {/* API Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Key className="w-3 h-3 text-brand-400" />
                      Google Gemini / AI API Key:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[10px] text-brand-300 hover:text-brand-200 flex items-center gap-1"
                    >
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showApiKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.aiApiKey}
                    onChange={(e) => onUpdateSettings({ aiApiKey: e.target.value })}
                    placeholder="sk-ant-... or sk-..."
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-brand-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400">
                    Stored securely in your local environment and IndexedDB. Never sent to third-party telemetry.
                  </p>
                </div>

                {/* Model & Personality Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Model Selector */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                    <span className="text-slate-300 font-medium block">AI Model:</span>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => onUpdateSettings({ aiModel: e.target.value as AIModelChoice })}
                      className="w-full bg-slate-800 border border-white/10 text-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-brand-500 text-xs"
                    >
                      <option value="auto">Auto / Smart Detect (Recommended)</option>
                      <option value="gemini-3.6-flash">Google Gemini 3.6 Flash</option>
                      <option value="gemini-3.5-flash-lite">Google Gemini 3.5 Flash Lite</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                      <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                      <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                    </select>
                  </div>

                  {/* Personality Style */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                    <span className="text-slate-300 font-medium block">Coach Persona Style:</span>
                    <select
                      value={settings.aiCoachStyle}
                      onChange={(e) => onUpdateSettings({ aiCoachStyle: e.target.value as CoachPersonality })}
                      className="w-full bg-slate-800 border border-white/10 text-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-brand-500 text-xs"
                    >
                      <option value="encouraging">Encouraging & Warm (🌟 Motivational)</option>
                      <option value="strict">Strict & Disciplined (🎯 High Standards)</option>
                      <option value="socratic">Socratic & Analytical (🧠 Cognitive Reflection)</option>
                    </select>
                  </div>
                </div>

                {/* Auto Insights Toggle & Connection Test */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.aiAutoInsights}
                      onChange={(e) => onUpdateSettings({ aiAutoInsights: e.target.checked })}
                      className="rounded border-white/20 bg-slate-800 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-slate-300 text-[11px]">Auto-generate insights when session ends</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleTestApi}
                    disabled={isTestingApi || !settings.aiApiKey}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600/30 hover:bg-brand-600/50 disabled:opacity-50 text-brand-200 border border-brand-500/40 transition-all font-medium"
                  >
                    {isTestingApi ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Test API Connection</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Test Result Box */}
                {apiTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 animate-fadeIn ${
                      apiTestResult.success
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {apiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {apiTestResult.success ? 'API Connection Successful!' : 'Connection Failed'}
                      </p>
                      <p className="text-[11px] opacity-90">{apiTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: Detection Duration Thresholds */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                State Machine Duration Thresholds
              </h3>
              <span className="text-[11px] text-slate-400">Sustain time before state triggers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Drowsy Threshold */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">Drowsiness Sustain:</span>
                  <span className="font-mono text-emerald-400">{settings.drowsyThresholdSec.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="6.0"
                  step="0.5"
                  value={settings.drowsyThresholdSec}
                  onChange={(e) => onUpdateSettings({ drowsyThresholdSec: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Continuous eye closure duration</p>
              </div>

              {/* Phone Threshold */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">Phone Usage Sustain:</span>
                  <span className="font-mono text-orange-400">{settings.phoneThresholdSec.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="10.0"
                  step="0.5"
                  value={settings.phoneThresholdSec}
                  onChange={(e) => onUpdateSettings({ phoneThresholdSec: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Phone in hand + gaze towards phone</p>
              </div>

              {/* Looking Away Threshold */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">Looking Away Sustain:</span>
                  <span className="font-mono text-amber-300">{settings.lookingAwayThresholdSec.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="20.0"
                  step="1.0"
                  value={settings.lookingAwayThresholdSec}
                  onChange={(e) => onUpdateSettings({ lookingAwayThresholdSec: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Glances are absorbed; only sustained turns trigger</p>
              </div>

              {/* Recovery Window */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">Focus Recovery Window:</span>
                  <span className="font-mono text-cyan-400">{settings.recoveryWindowSec.toFixed(0)}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={settings.recoveryWindowSec}
                  onChange={(e) => onUpdateSettings({ recoveryWindowSec: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Sustained studying to clear distraction</p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Lite Mode & Performance */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Lite Performance Mode</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Disables heavy object detection for low-power laptops or Chromebooks while keeping Face & Pose tracking.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.liteMode}
                onChange={(e) => onUpdateSettings({ liteMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* SECTION 4: Audio & Nudge Preferences */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                Audio Coaching & Chimes
              </h3>
              <button
                onClick={testAudio}
                className="flex items-center gap-1 text-[11px] text-brand-300 hover:text-brand-200 transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test Audio Nudge</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chime Volume */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">Chime Volume:</span>
                  <span className="font-mono text-white">{Math.round(settings.soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.soundVolume}
                  onChange={(e) => onUpdateSettings({ soundVolume: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>

              {/* Sound Theme */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">Sound Tone Theme:</span>
                </div>
                <select
                  value={settings.soundTheme}
                  onChange={(e) => onUpdateSettings({ soundTheme: e.target.value as any })}
                  className="w-full bg-slate-800 border border-white/10 text-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-brand-500"
                >
                  <option value="zen_bell">Zen Singing Bell (528 Hz Harmonic)</option>
                  <option value="soft_synth">Soft Warm Synth</option>
                  <option value="marimba">Gentle Marimba</option>
                </select>
              </div>

              {/* TTS Voice Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between sm:col-span-2">
                <div>
                  <h4 className="font-medium text-white">Spoken Voice Coaching (TTS)</h4>
                  <p className="text-[10px] text-slate-400">Plays spoken audio reminders on Level 2 & 3 nudges</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ttsEnabled}
                    onChange={(e) => onUpdateSettings({ ttsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 5: Calibration & Baseline Profile */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-white">Posture & Gaze Baseline</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Calibrated EAR: {calibration.neutralEAR} • Pitch: {calibration.neutralPitch}° • Yaw: {calibration.neutralYaw}°
              </p>
            </div>
            <button
              onClick={onOpenCalibration}
              className="px-3 py-1.5 rounded-xl bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 border border-brand-500/40 font-medium transition-all"
            >
              Re-Calibrate
            </button>
          </div>

          {/* SECTION 6: Privacy & Local Data Wipe */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="font-medium text-white">Privacy & Local Database</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All records are stored exclusively in your browser's local IndexedDB. You can export or erase your data at any time.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onExportAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-medium transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Database</span>
              </button>
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-medium transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Erase All Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
          <button
            onClick={onResetDefaults}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default Sensitivities</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/25 transition-all"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
