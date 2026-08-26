import React from 'react';
import {
  Brain,
  ShieldCheck,
  Zap,
  Volume2,
  VolumeX,
  Settings,
  BarChart3,
  Sparkles,
  Sliders,
  CloudRain,
} from 'lucide-react';
import { AppSettings, CycleType } from '../types';

interface NavbarProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenAnalytics: () => void;
  onOpenCalibration: () => void;
  selectedCycle: CycleType;
  onSelectCycle: (cycle: CycleType) => void;
  isSessionActive: boolean;
  isCameraActive: boolean;
  fps: number;
  isAmbientPlaying: boolean;
  ambientVolume: number;
  onToggleAmbient: () => void;
  onChangeAmbientVolume: (vol: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenAnalytics,
  onOpenCalibration,
  selectedCycle,
  onSelectCycle,
  isSessionActive,
  isCameraActive,
  fps,
  isAmbientPlaying,
  ambientVolume,
  onToggleAmbient,
  onChangeAmbientVolume,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0F1D]/80 backdrop-blur-xl px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Privacy Trust */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 text-white shadow-lg shadow-brand-500/25 border border-brand-400/30">
          <Brain className="w-5 h-5 animate-breath" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-lg text-white tracking-tight">AI Study Monitor</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              100% On-Device
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">Self-Directed Focus & Posture Coach</p>
        </div>
      </div>

      {/* Cycle Selector (Only active when session is not running) */}
      <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-white/10 text-xs">
        <button
          onClick={() => !isSessionActive && onSelectCycle('pomodoro_25_5')}
          disabled={isSessionActive}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedCycle === 'pomodoro_25_5'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          } ${isSessionActive ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          Pomodoro (25/5)
        </button>
        <button
          onClick={() => !isSessionActive && onSelectCycle('deepwork_50_10')}
          disabled={isSessionActive}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedCycle === 'deepwork_50_10'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          } ${isSessionActive ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          Deep Work (50/10)
        </button>
        <button
          onClick={() => !isSessionActive && onSelectCycle('freeform')}
          disabled={isSessionActive}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedCycle === 'freeform'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          } ${isSessionActive ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          Freeform
        </button>
      </div>

      {/* Right Controls & Utilities */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Lite Mode Toggle */}
        <button
          onClick={() => onUpdateSettings({ liteMode: !settings.liteMode })}
          title={settings.liteMode ? 'Lite Mode Active (low battery / CPU friendly)' : 'Switch to Lite Mode'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            settings.liteMode
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${settings.liteMode ? 'text-amber-400' : ''}`} />
          <span className="hidden md:inline">{settings.liteMode ? 'Lite Mode' : 'Standard Mode'}</span>
        </button>

        {/* FPS Indicator */}
        {isCameraActive && (
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[11px] text-slate-400 font-mono">
            <span>{fps} FPS</span>
          </div>
        )}

        {/* Ambient Rain Controller */}
        <div className="flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/10 rounded-xl transition-all hover:bg-white/10">
          <button
            onClick={onToggleAmbient}
            className={`p-1.5 rounded-lg transition-colors ${
              isAmbientPlaying ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
            title={isAmbientPlaying ? 'Pause Ambient Rain' : 'Play Ambient Rain'}
          >
            <CloudRain className="w-4 h-4" />
          </button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={ambientVolume}
            onChange={(e) => onChangeAmbientVolume(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-blue-400 h-1.5 bg-slate-700 rounded-full appearance-none outline-none"
            title="Adjust Ambient Volume"
          />
        </div>

        {/* Audio Mute Toggle (Coaching Chimes) */}
        <button
          onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
          className={`p-2 rounded-xl border transition-all ${
            settings.soundEnabled
              ? 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
          }`}
          title={settings.soundEnabled ? 'Mute Coaching Chimes' : 'Unmute Coaching Chimes'}
        >
          {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Re-calibrate Button */}
        <button
          onClick={onOpenCalibration}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 text-xs font-medium transition-all"
          title="Recalibrate Posture & Gaze Baseline"
        >
          <Sliders className="w-3.5 h-3.5 text-brand-400" />
          <span className="hidden sm:inline">Calibrate</span>
        </button>

        {/* History / Analytics Modal */}
        <button
          onClick={onOpenAnalytics}
          className="p-2 rounded-xl bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 transition-all"
          title="Session Analytics & Streaks"
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" />
        </button>

        {/* Settings Modal */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 transition-all"
          title="Settings & Privacy"
        >
          <Settings className="w-4 h-4 text-slate-300" />
        </button>
      </div>
    </header>
  );
};
