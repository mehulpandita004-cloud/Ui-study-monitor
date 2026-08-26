import React, { useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  Tv,
} from 'lucide-react';
import { RawVisionFrame, AppSettings } from '../types';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  settings: AppSettings;
  latestFrame: RawVisionFrame | null;
  onToggleOverlay: () => void;
  onRetryCamera: () => void;
  onStartSimulation: () => void;
  isDemoMode: boolean;
  isPaused: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onSwitchDevice: (id: string) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  isStreaming,
  isLoading,
  error,
  settings,
  latestFrame,
  onToggleOverlay,
  onRetryCamera,
  onStartSimulation,
  isDemoMode,
  isPaused,
  devices,
  selectedDeviceId,
  onSwitchDevice,
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPrivacyBlind, setIsPrivacyBlind] = useState<boolean>(false);

  return (
    <div className="relative w-full aspect-video rounded-3xl overflow-hidden glass-panel border border-white/10 flex flex-col items-center justify-center bg-slate-950 shadow-2xl group">
      {/* Video element */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          video.play().catch((err) => console.warn('Video onLoadedMetadata play note:', err?.message || err));
        }}
        className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
          isStreaming && !isPrivacyBlind && !isPaused ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Overlay Canvas for HUD (Keypoints, Gaze vector, Phone box) */}
      <canvas
        ref={overlayCanvasRef}
        id="hud-overlay-canvas"
        className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none transition-opacity duration-200 ${
          settings.showLandmarkOverlay && isStreaming && !isPrivacyBlind && !isPaused
            ? 'opacity-100'
            : 'opacity-0'
        }`}
      />

      {/* Privacy Blind State */}
      {isStreaming && isPrivacyBlind && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070B14]/95 backdrop-blur-md p-6 text-center">
          <EyeOff className="w-10 h-10 text-slate-500 mb-2" />
          <h3 className="text-sm font-semibold text-slate-200">Camera Preview Blinded</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Computer vision is still coaching in background, but the video preview is hidden for your comfort.
          </p>
          <button
            onClick={() => setIsPrivacyBlind(false)}
            className="mt-4 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-all"
          >
            Show Preview
          </button>
        </div>
      )}

      {/* Paused Monitoring State */}
      {isPaused && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070B14]/90 backdrop-blur-md p-6 text-center">
          <CameraOff className="w-10 h-10 text-amber-400 mb-2 animate-pulse" />
          <h3 className="text-base font-display font-bold text-amber-300">Monitoring Temporarily Paused</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Camera vision processing is suspended. Take your time.
          </p>
        </div>
      )}

      {/* Camera Inactive State (Prominent Activation Prompt + Simulation option) */}
      {!isStreaming && !isLoading && (
        <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center max-w-md animate-fadeIn">
          {error ? (
            <>
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 mb-3">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-white">Camera Connection Help</h3>
              <p className="text-xs text-slate-300 mt-1 mb-4 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-white/5 text-left">
                {error}
              </p>
            </>
          ) : (
            <>
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-brand-500/20 animate-ping opacity-50" />
                <div className="p-3.5 rounded-2xl bg-brand-600/30 border border-brand-400/40 text-brand-300 relative">
                  <Camera className="w-8 h-8" />
                </div>
              </div>
              <h3 className="text-base font-display font-bold text-white">Camera Is Ready to Start</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4 max-w-xs leading-relaxed">
                Click below to connect your webcam, or run simulation mode to preview AI monitoring without a camera.
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={onRetryCamera}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-500 hover:brightness-110 text-white text-xs font-semibold shadow-lg shadow-brand-500/30 active:scale-95 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{error ? 'Retry Physical Camera' : 'Turn On Webcam'}</span>
            </button>

            <button
              onClick={onStartSimulation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium border border-white/10 active:scale-95 transition-all"
              title="Test with simulated camera feed if no physical webcam is available"
            >
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span>Simulation Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="relative z-10 flex flex-col items-center justify-center p-6">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-3" />
          <p className="text-xs font-medium text-slate-300">Connecting to webcam & AI models...</p>
        </div>
      )}

      {/* Top Bar Floating Badges */}
      {isStreaming && (
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          {/* Lighting Status Badge / Simulation Badge */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {isDemoMode ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-600/90 text-white backdrop-blur-md border border-indigo-400/50 shadow-md">
                <Tv className="w-3 h-3" />
                <span>Demo Simulation</span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-md border ${
                  latestFrame?.lightingCondition === 'good'
                    ? 'bg-slate-900/80 text-emerald-300 border-emerald-500/30'
                    : latestFrame?.lightingCondition === 'low'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                    : 'bg-slate-900/80 text-slate-300 border-white/10'
                }`}
              >
                {latestFrame?.lightingCondition === 'good' ? (
                  <Sun className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Moon className="w-3 h-3 text-amber-400" />
                )}
                <span>
                  {latestFrame?.lightingCondition === 'good'
                    ? 'Good Light'
                    : latestFrame?.lightingCondition === 'low'
                    ? 'Low Light'
                    : 'Lighting OK'}
                </span>
              </div>
            )}

            {/* Device Selector */}
            {devices.length > 1 && !isDemoMode && (
              <select
                value={selectedDeviceId}
                onChange={(e) => onSwitchDevice(e.target.value)}
                className="bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-300 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-brand-500 cursor-pointer pointer-events-auto"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* HUD Overlay & Privacy Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* Toggle HUD */}
            <button
              onClick={onToggleOverlay}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-md border transition-all ${
                settings.showLandmarkOverlay
                  ? 'bg-brand-600/80 text-white border-brand-400/50 shadow-md shadow-brand-500/30'
                  : 'bg-slate-900/80 text-slate-400 border-white/10 hover:text-slate-200'
              }`}
              title="Toggle AI Skeleton & Landmark Overlay"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">HUD Overlay</span>
            </button>

            {/* Blind Preview */}
            <button
              onClick={() => setIsPrivacyBlind(!isPrivacyBlind)}
              className="p-1.5 rounded-full bg-slate-900/80 text-slate-300 border border-white/10 hover:bg-slate-800 backdrop-blur-md transition-all"
              title={isPrivacyBlind ? 'Show Preview' : 'Hide / Blind Video Preview'}
            >
              {isPrivacyBlind ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Subtle Status Bar */}
      {isStreaming && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-[11px] text-slate-400 backdrop-blur-md bg-slate-950/70 px-3 py-1.5 rounded-xl border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {isDemoMode ? 'Simulated Study Feed Active' : 'Client-Side MediaPipe Inference Active'}
          </span>
          <span className="font-mono">
            {latestFrame?.isFaceDetected ? 'Face Locked' : 'Searching Face...'}
          </span>
        </div>
      )}
    </div>
  );
};
