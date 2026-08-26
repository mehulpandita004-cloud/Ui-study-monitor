import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebcam } from './hooks/useWebcam';
import { visionPipeline } from './vision/visionPipeline';
import { StudyStateMachine, StateMachineStatus } from './engine/stateMachine';
import { WarningEngine } from './engine/warningEngine';
import { FocusScoreEngine } from './engine/focusScore';
import { SessionManager } from './engine/sessionManager';
import { audioEngine } from './engine/audioEngine';
import { db } from './db';
import {
  AppSettings,
  CalibrationProfile,
  RawVisionFrame,
  StudyState,
  FocusScoreBreakdown,
  WarningNotification,
  SessionPhase,
  StudySession,
  CycleType,
  SessionGoal,
} from './types';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from './utils/constants';

import { Navbar } from './components/Navbar';
import { CameraView } from './components/CameraView';
import { StatusPanel } from './components/StatusPanel';
import { ManualOverridesBar } from './components/ManualOverridesBar';
import { WarningToast } from './components/WarningToast';
import { OnboardingModal } from './components/OnboardingModal';
import { CalibrationModal } from './components/CalibrationModal';
import { PostSessionModal } from './components/PostSessionModal';
import { HistoricalDashboard } from './components/HistoricalDashboard';
import { SettingsModal } from './components/SettingsModal';
import { GoalModal } from './components/GoalModal';

export function App() {
  // 1. Settings & Calibration State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [calibration, setCalibration] = useState<CalibrationProfile>(DEFAULT_CALIBRATION);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // 2. Camera Hook
  const {
    stream,
    videoRef,
    devices,
    selectedDeviceId,
    isStreaming,
    isLoading: isCameraLoading,
    error: cameraError,
    isDemoMode,
    startStream,
    startDemoSimulation,
    switchDevice,
  } = useWebcam();

  // 3. UI Modals State
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showCalibration, setShowCalibration] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showHistorical, setShowHistorical] = useState<boolean>(false);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [currentGoal, setCurrentGoal] = useState<SessionGoal>(() => ({
    id: 'goal_initial',
    topic: '',
    notes: '',
    createdAt: 0,
  }));
  const [completedSession, setCompletedSession] = useState<StudySession | null>(null);

  // 4. Vision & Engine Live State
  const [latestFrame, setLatestFrame] = useState<RawVisionFrame | null>(null);
  const [currentState, setCurrentState] = useState<StudyState>('STUDYING');
  const [displayLabel, setDisplayLabel] = useState<string>('Likely Studying');
  const [stateConfidence, setStateConfidence] = useState<number>(0.92);
  const [activeNotification, setActiveNotification] = useState<WarningNotification | null>(null);
  const [focusBreakdown, setFocusBreakdown] = useState<FocusScoreBreakdown>({
    currentScore: 100,
    smoothedScore: 100,
    distractionPenalty: 0,
    drowsyPenalty: 0,
    phonePenalty: 0,
    awayPenalty: 0,
    warningPenalty: 0,
    postureBonus: 0,
  });

  // 5. Session State
  const [selectedCycle, setSelectedCycle] = useState<CycleType>('pomodoro_25_5');
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('idle');
  const [currentSession, setCurrentSession] = useState<StudySession | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(25 * 60);

  // 6. Overrides State
  const [isBreakOverride, setIsBreakOverride] = useState<boolean>(false);
  const [isMonitoringPaused, setIsMonitoringPaused] = useState<boolean>(false);
  const [remainingPauseSec, setRemainingPauseSec] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);

  // 7. Ambient Sound State
  const [ambientVolume, setAmbientVolume] = useState<number>(0.5);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState<boolean>(false);

  const toggleAmbientSound = () => {
    if (isAmbientPlaying) {
      audioEngine.stopAmbientSound();
      setIsAmbientPlaying(false);
    } else {
      audioEngine.startAmbientSound(ambientVolume);
      setIsAmbientPlaying(true);
    }
  };

  const handleAmbientVolumeChange = (vol: number) => {
    setAmbientVolume(vol);
    audioEngine.setAmbientVolume(vol);
  };

  // Engine instance refs
  const stateMachineRef = useRef<StudyStateMachine | null>(null);
  const warningEngineRef = useRef<WarningEngine | null>(null);
  const focusScoreEngineRef = useRef<FocusScoreEngine | null>(null);
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const inferenceLoopRef = useRef<any>(null);

  // Initialize DB & settings on mount
  useEffect(() => {
    async function loadData() {
      await db.initializeDefaults();
      const savedSettings = await db.getSettings();
      const savedCalibration = await db.getCalibration();

      setSettings(savedSettings);
      setCalibration(savedCalibration);

      // Initialize Engines
      const sm = new StudyStateMachine(savedSettings, savedCalibration, (transition) => {
        if (sessionManagerRef.current) {
          sessionManagerRef.current.logEvent(
            transition.newState.toLowerCase() as any,
            transition.confidence,
            0,
            { reason: transition.reason }
          );
        }
      });
      stateMachineRef.current = sm;

      const we = new WarningEngine(savedSettings, (notification) => {
        setActiveNotification(notification);
        if (sessionManagerRef.current) {
          sessionManagerRef.current.incrementWarningCount();
          sessionManagerRef.current.logEvent('warning_triggered', 1.0, 0, {
            category: notification.category,
            severity: notification.severity,
            message: notification.message,
          });
        }
      });
      warningEngineRef.current = we;

      const fe = new FocusScoreEngine(savedSettings);
      focusScoreEngineRef.current = fe;

      const smgr = new SessionManager(
        (session, phase, rem) => {
          setCurrentSession({ ...session });
          setSessionPhase(phase);
          setRemainingSec(rem);
        },
        (newPhase) => {
          setSessionPhase(newPhase);
        },
        (finished) => {
          setCompletedSession(finished);
        }
      );
      sessionManagerRef.current = smgr;

      setIsInitialized(true);

      // Check onboarding
      if (!savedSettings.hasCompletedOnboarding) {
        setShowOnboarding(true);
      } else {
        // Start camera + preload sounds for returning users
        audioEngine.preloadSounds();
        startStream(savedSettings.cameraDeviceId);
      }

      // Initialize vision models in background
      visionPipeline.initialize();
    }

    loadData();

    return () => {
      if (inferenceLoopRef.current) cancelAnimationFrame(inferenceLoopRef.current);
    };
  }, []);

  // Update engine configurations whenever settings or calibration change
  useEffect(() => {
    if (stateMachineRef.current) stateMachineRef.current.updateConfig(settings, calibration);
    if (warningEngineRef.current) warningEngineRef.current.updateSettings(settings);
    if (focusScoreEngineRef.current) focusScoreEngineRef.current.updateSettings(settings);
  }, [settings, calibration]);

  // Main Computer Vision & State Machine Loop (Decoupled throttled inference 6-10 FPS)
  useEffect(() => {
    if (!isInitialized || !isStreaming || !videoRef.current) return;

    let isProcessing = false;
    let lastInference = 0;
    const targetInterval = settings.liteMode ? 140 : 100; // ~7-10 FPS

    const runLoop = async () => {
      const now = performance.now();

      if (!isProcessing && now - lastInference >= targetInterval && videoRef.current) {
        isProcessing = true;
        lastInference = now;

        const overlayCanvas = document.getElementById('hud-overlay-canvas') as HTMLCanvasElement | null;
        const frame = await visionPipeline.processVideoFrame(
          videoRef.current,
          settings,
          calibration,
          overlayCanvas
        );

        if (frame && stateMachineRef.current) {
          setLatestFrame(frame);

          // 1. Run State Machine
          const smStatus: StateMachineStatus = stateMachineRef.current.processFrame(frame);
          setCurrentState(smStatus.currentState);
          setDisplayLabel(smStatus.displayLabel);
          setStateConfidence(smStatus.stateConfidence);

          // 2. Evaluate Warning Engine
          if (warningEngineRef.current && sessionPhase === 'study') {
            warningEngineRef.current.evaluateState(
              smStatus.currentState,
              smStatus.stateDurationSec,
              isBreakOverride
            );
          }

          // 2b. Real-time continuous sound effects (driven by raw vision signals)
          // Only play alarm sounds during an active study session to avoid
          // blasting audio on the homepage when no session is running.
          if (settings.soundEnabled && sessionPhase === 'study') {
            // Eye-closed alarm: plays when eye openness drops below 80%, stops when above
            if (frame.eyeOpenness < 80) {
              audioEngine.startEyeClosedAlarm(settings.soundVolume);
            } else {
              audioEngine.stopEyeClosedAlarm();
            }

            // Phone alarm: plays while phone is detected, stops otherwise
            if (frame.phoneDetected) {
              audioEngine.startPhoneAlarm(settings.soundVolume);
            } else {
              audioEngine.stopPhoneAlarm();
            }

            // Looking-away alarm: plays while looking away, stops when facing back
            if (frame.isLookingAway) {
              audioEngine.startLookingAwayAlarm(settings.soundVolume);
            } else {
              audioEngine.stopLookingAwayAlarm();
            }
          } else {
            // Sound disabled or no active study session — make sure loops are off
            audioEngine.stopAllLoops();
          }

          // 3. Accumulate Time & Focus Score
          if (sessionManagerRef.current && focusScoreEngineRef.current) {
            const currentSess = sessionManagerRef.current.getCurrentSession();
            if (currentSess && sessionPhase === 'study') {
              const breakdown = focusScoreEngineRef.current.calculate(
                currentSess.totalFocusedSec,
                currentSess.totalDistractedSec,
                currentSess.totalDrowsySec,
                currentSess.totalPhoneSec,
                currentSess.totalAwaySec,
                currentSess.warningCount,
                frame.postureScore
              );
              setFocusBreakdown(breakdown);
              sessionManagerRef.current.recordSecondState(
                smStatus.currentState,
                frame.postureScore,
                breakdown.smoothedScore
              );
            }
          }
        }

        // Measure FPS
        const pStatus = visionPipeline.getStatus();
        setFps(pStatus.fps);

        // Update remaining pause seconds if paused
        if (stateMachineRef.current) {
          setIsMonitoringPaused(stateMachineRef.current.isPaused());
          setRemainingPauseSec(stateMachineRef.current.getRemainingPauseSeconds());
        }

        isProcessing = false;
      }

      inferenceLoopRef.current = requestAnimationFrame(runLoop);
    };

    inferenceLoopRef.current = requestAnimationFrame(runLoop);

    return () => {
      if (inferenceLoopRef.current) cancelAnimationFrame(inferenceLoopRef.current);
      audioEngine.stopAllLoops();
    };
  }, [isInitialized, isStreaming, settings, calibration, sessionPhase, isBreakOverride]);

  // Handlers
  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    const updated = await db.updateSettings(partial);
    setSettings(updated);
  };

  const handleSaveCalibration = async (profile: CalibrationProfile) => {
    await db.saveCalibration(profile);
    setCalibration(profile);
    setShowCalibration(false);
  };

  const handleCompleteOnboarding = async () => {
    await handleUpdateSettings({ hasCompletedOnboarding: true });
    setShowOnboarding(false);
    // Preload sound files after user gesture (satisfies browser autoplay policy)
    audioEngine.preloadSounds();
    await startStream();
    setShowCalibration(true);
  };

  const handleToggleBreakOverride = () => {
    const next = !isBreakOverride;
    setIsBreakOverride(next);
    if (stateMachineRef.current) {
      stateMachineRef.current.setBreakOverride(next);
    }
  };

  const handlePauseMonitoring = (minutes: number) => {
    if (stateMachineRef.current) {
      stateMachineRef.current.setMonitoringPause(minutes);
      setIsMonitoringPaused(stateMachineRef.current.isPaused());
      setRemainingPauseSec(stateMachineRef.current.getRemainingPauseSeconds());
    }
  };

  const handleLogFalsePositive = async (reportedState: StudyState, reason?: string) => {
    await db.logFalsePositive({
      id: `fp_${Date.now()}`,
      timestamp: Date.now(),
      sessionId: currentSession?.id,
      state: reportedState,
      severity: activeNotification?.severity || 1,
      reason: reason || 'User tapped false alarm',
    });
    if (sessionManagerRef.current) {
      sessionManagerRef.current.incrementOverrideCount();
    }
    if (warningEngineRef.current) {
      warningEngineRef.current.resetCategory(reportedState);
    }
    setActiveNotification(null);
  };

  const handleStartSession = (cycle: CycleType) => {
    if (sessionManagerRef.current) {
      const sess = sessionManagerRef.current.startSession(cycle);
      setCurrentSession(sess);
      setSessionPhase('study');
    }
  };

  const handlePauseSession = () => {
    if (sessionManagerRef.current) {
      sessionManagerRef.current.pauseSession();
      setSessionPhase('paused');
    }
  };

  const handleResumeSession = () => {
    if (sessionManagerRef.current) {
      sessionManagerRef.current.resumeSession();
      setSessionPhase('study');
    }
  };

  const handleEndSession = async () => {
    if (sessionManagerRef.current) {
      const finished = await sessionManagerRef.current.endSession();
      if (finished) {
        setCompletedSession(finished);
      }
      setSessionPhase('idle');
      setCurrentSession(null);
    }
  };

  const handleExportAll = async () => {
    const json = await db.exportAllDataAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_study_monitor_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to permanently erase all local session history and data?')) {
      await db.clearAllData();
      alert('All local data wiped successfully.');
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col selection:bg-brand-500/30 selection:text-brand-200 relative z-0">
      {/* Immersive Vesper-style Video Background */}
      <div className="fixed inset-0 w-full h-full z-[-1] overflow-hidden bg-black" aria-hidden="true">
        <div className="absolute inset-0 z-20 pointer-events-none opacity-40 mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        <video 
          className="absolute inset-0 w-full h-full object-cover z-0" 
          autoPlay loop muted playsInline 
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4"
        ></video>
        {/* Subtle dark overlay so text remains readable */}
        <div className="absolute inset-0 bg-black/30 z-10"></div>
      </div>

      {/* Top Navigation */}
      <Navbar
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAnalytics={() => setShowHistorical(true)}
        onOpenCalibration={() => setShowCalibration(true)}
        selectedCycle={selectedCycle}
        onSelectCycle={setSelectedCycle}
        isSessionActive={sessionPhase !== 'idle'}
        isCameraActive={isStreaming}
        fps={fps}
        isAmbientPlaying={isAmbientPlaying}
        ambientVolume={ambientVolume}
        onToggleAmbient={toggleAmbientSound}
        onChangeAmbientVolume={handleAmbientVolumeChange}
      />

      {/* Floating Warning Toast */}
      <WarningToast
        notification={activeNotification}
        onDismiss={() => setActiveNotification(null)}
        onReportFalseAlarm={(n) => handleLogFalsePositive(n.category, 'User reported via toast')}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Split View: Camera & Live Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Camera Feed with HUD Overlay (5 cols on lg) */}
          <div className="lg:col-span-5 w-full">
            <CameraView
              videoRef={videoRef}
              isStreaming={isStreaming}
              isLoading={isCameraLoading}
              error={cameraError}
              settings={settings}
              latestFrame={latestFrame}
              onToggleOverlay={() =>
                handleUpdateSettings({ showLandmarkOverlay: !settings.showLandmarkOverlay })
              }
              onRetryCamera={() => startStream()}
              onStartSimulation={startDemoSimulation}
              isDemoMode={isDemoMode}
              isPaused={isMonitoringPaused}
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onSwitchDevice={switchDevice}
            />
          </div>

          {/* Right: Live Status & Metrics Panel (7 cols on lg) */}
          <div className="lg:col-span-7 w-full">
            <StatusPanel
              currentState={currentState}
              displayLabel={displayLabel}
              confidence={stateConfidence}
              focusBreakdown={focusBreakdown}
              latestFrame={latestFrame}
              sessionPhase={sessionPhase}
              currentSession={currentSession}
              remainingSec={remainingSec}
              onStartSession={handleStartSession}
              onPauseSession={handlePauseSession}
              onResumeSession={handleResumeSession}
              onEndSession={handleEndSession}
              selectedCycle={selectedCycle}
              currentGoal={currentGoal}
              onOpenGoalModal={() => setShowGoalModal(true)}
              settings={settings}
            />
          </div>
        </div>

        {/* Bottom Bar: Manual Overrides */}
        <ManualOverridesBar
          isBreakOverride={isBreakOverride}
          onToggleBreakOverride={handleToggleBreakOverride}
          isMonitoringPaused={isMonitoringPaused}
          remainingPauseSec={remainingPauseSec}
          onPauseMonitoring={handlePauseMonitoring}
          onLogFalsePositive={(st) => handleLogFalsePositive(st, 'Manual override bar')}
          currentState={currentState}
        />
      </main>

      {/* Footer info & privacy reassurance */}
      <footer className="border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        <p>AI Study Monitor • Self-Directed On-Device Focus Companion</p>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowOnboarding(true)} className="hover:text-slate-300 transition-colors">
            Privacy Principles
          </button>
          <button onClick={() => setShowGoalModal(true)} className="hover:text-slate-300 transition-colors">
            Study Goal
          </button>
          <button onClick={() => setShowHistorical(true)} className="hover:text-slate-300 transition-colors">
            Past Sessions
          </button>
          <button onClick={() => setShowSettings(true)} className="hover:text-slate-300 transition-colors">
            Sensitivities & Gemini AI
          </button>
        </div>
      </footer>

      {/* Modals */}
      <OnboardingModal isOpen={showOnboarding} onComplete={handleCompleteOnboarding} />

      <CalibrationModal
        isOpen={showCalibration}
        onSaveCalibration={handleSaveCalibration}
        onCancel={() => setShowCalibration(false)}
        latestFrame={latestFrame}
        videoElement={videoRef.current}
      />

      <GoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        goal={currentGoal}
        onSaveGoal={(g) => setCurrentGoal(g)}
        activeSession={currentSession || completedSession}
        settings={settings}
      />

      <PostSessionModal
        session={completedSession}
        onClose={() => setCompletedSession(null)}
        onDeleteSession={async (id) => {
          await db.sessions.delete(id);
          setCompletedSession(null);
        }}
        focusBreakdown={focusBreakdown}
        settings={settings}
      />

      <HistoricalDashboard
        isOpen={showHistorical}
        onClose={() => setShowHistorical(false)}
        onExportAll={handleExportAll}
        onClearAll={handleClearAll}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        calibration={calibration}
        onUpdateSettings={handleUpdateSettings}
        onResetDefaults={() => handleUpdateSettings(DEFAULT_SETTINGS)}
        onOpenCalibration={() => {
          setShowSettings(false);
          setShowCalibration(true);
        }}
        onExportAll={handleExportAll}
        onClearAll={handleClearAll}
      />
    </div>
  );
}

export default App;
