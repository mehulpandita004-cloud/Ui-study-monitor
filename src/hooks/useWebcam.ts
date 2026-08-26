// ==========================================
// Webcam Stream Hook with Real Webcam + Demo Simulation Mode
// Handles WebRTC getUserMedia, device selection, and simulated fallback
// ==========================================

import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebcamState {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  isDemoMode: boolean;
  startStream: (deviceId?: string) => Promise<boolean>;
  startDemoSimulation: () => void;
  stopStream: () => void;
  switchDevice: (newDeviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
}

export function useWebcam(initialDeviceId?: string): WebcamState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(initialDeviceId || '');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simAnimIdRef = useRef<number | null>(null);

  // Helper to attach stream to video element safely
  const attachStreamToVideo = useCallback((mediaStream: MediaStream) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.srcObject !== mediaStream) {
      video.srcObject = mediaStream;
    }
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Interrupted or autoplay delayed until user gesture/loadedmetadata
        console.warn('Video play() note:', err?.message || err);
      });
    }
  }, []);

  // Enumerate video input devices
  const refreshDevices = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId((prev) => prev || videoDevices[0].deviceId);
      }
    } catch (e) {
      console.warn('Error enumerating video devices:', e);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (simAnimIdRef.current) {
      cancelAnimationFrame(simAnimIdRef.current);
      simAnimIdRef.current = null;
    }
    if (simCanvasRef.current) {
      simCanvasRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsStreaming(false);
    setIsDemoMode(false);
  }, []);

  const startStream = useCallback(
    async (deviceId?: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      // Stop previous stream first without resetting UI error state
      if (simAnimIdRef.current) {
        cancelAnimationFrame(simAnimIdRef.current);
        simAnimIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        const errorMsg =
          'Camera API is not supported in this browser environment or insecure context. Please ensure you are running on http://localhost or HTTPS.';
        setError(errorMsg);
        setIsStreaming(false);
        setIsLoading(false);
        return false;
      }

      const targetId = deviceId || selectedDeviceId;
      let newStream: MediaStream | null = null;

      // Strategy 1: Attempt with preferred ideal constraints
      const constraints: MediaStreamConstraints = {
        video: targetId
          ? {
              deviceId: { ideal: targetId },
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
        audio: false,
      };

      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: any) {
        console.warn('Preferred constraints failed, attempting fallback to basic video constraints:', firstErr);
        try {
          // Strategy 2: Basic video constraints fallback
          newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (fallbackErr: any) {
          console.error('All physical camera attempts failed:', fallbackErr);
          const errName = fallbackErr?.name || firstErr?.name;
          const errMsg =
            errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
              ? 'Camera permission denied. Please click the camera/lock icon in your browser address bar to allow camera access.'
              : errName === 'NotFoundError' || errName === 'DevicesNotFoundError'
              ? 'No physical camera detected. Make sure your webcam is plugged in, or use Simulation Mode below.'
              : errName === 'NotReadableError' || errName === 'TrackStartError'
              ? 'Webcam is in use by another app (Zoom, Teams, Discord). Please close other camera apps and retry.'
              : `Unable to open camera: ${fallbackErr?.message || 'Check webcam connection'}`;

          setError(errMsg);
          setIsStreaming(false);
          setIsLoading(false);
          return false;
        }
      }

      if (newStream) {
        streamRef.current = newStream;
        setStream(newStream);
        setHasPermission(true);
        setIsStreaming(true);
        setIsLoading(false);
        setIsDemoMode(false);
        setError(null);

        attachStreamToVideo(newStream);
        await refreshDevices();
        return true;
      }

      setIsLoading(false);
      return false;
    },
    [selectedDeviceId, attachStreamToVideo, refreshDevices]
  );

  /**
   * Starts a synthetic simulated camera feed for testing without physical webcam
   */
  const startDemoSimulation = useCallback(() => {
    // Stop previous stream
    if (simAnimIdRef.current) {
      cancelAnimationFrame(simAnimIdRef.current);
      simAnimIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsLoading(true);
    setError(null);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    simCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    let frameCount = 0;

    const renderSim = () => {
      if (!ctx) return;
      frameCount++;
      const time = frameCount / 30; // seconds

      // Background room gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 640, 480);
      bgGrad.addColorStop(0, '#1E293B');
      bgGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 640, 480);

      // Desk surface
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 360, 640, 120);

      // Simulated student body
      const headBob = Math.sin(time * 1.5) * 4;
      const headTurn = Math.sin(time * 0.3) * 15; // occasional gaze drift

      // Torso / Shoulders
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(320, 350 + headBob * 0.5, 140, 90, 0, 0, Math.PI * 2);
      ctx.fill();

      // Neck
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(305, 230 + headBob, 30, 40);

      // Head
      ctx.fillStyle = '#FED7AA';
      ctx.beginPath();
      ctx.ellipse(320 + headTurn * 0.5, 190 + headBob, 60, 75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#1E1B4B';
      ctx.beginPath();
      ctx.ellipse(320 + headTurn * 0.5, 145 + headBob, 65, 45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (with periodic natural blinks)
      const isBlinking = Math.sin(time * 4) > 0.95;
      const eyeH = isBlinking ? 1 : 6;
      ctx.fillStyle = '#0F172A';

      // Left Eye
      ctx.beginPath();
      ctx.ellipse(298 + headTurn * 0.4, 185 + headBob, 8, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Right Eye
      ctx.beginPath();
      ctx.ellipse(342 + headTurn * 0.4, 185 + headBob, 8, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Smile / Neutral mouth
      ctx.strokeStyle = '#EA580C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(320 + headTurn * 0.5, 220 + headBob, 14, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Watermark badge
      ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
      ctx.fillRect(20, 20, 200, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('CAMERA SIMULATION MODE', 30, 40);

      simAnimIdRef.current = requestAnimationFrame(renderSim);
    };

    renderSim();

    // Capture stream from canvas
    const simStream = canvas.captureStream(30);
    streamRef.current = simStream;
    setStream(simStream);
    setIsStreaming(true);
    setIsDemoMode(true);
    setIsLoading(false);
    setError(null);

    attachStreamToVideo(simStream);
  }, [attachStreamToVideo]);

  const switchDevice = useCallback(
    async (newDeviceId: string) => {
      setSelectedDeviceId(newDeviceId);
      await startStream(newDeviceId);
    },
    [startStream]
  );

  // Sync stream to video ref if stream changes or video is mounted
  useEffect(() => {
    if (stream && videoRef.current) {
      attachStreamToVideo(stream);
    }
  }, [stream, attachStreamToVideo]);

  // Clean up tracks on unmount only
  useEffect(() => {
    return () => {
      if (simAnimIdRef.current) {
        cancelAnimationFrame(simAnimIdRef.current);
        simAnimIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    stream,
    videoRef,
    devices,
    selectedDeviceId,
    isStreaming,
    isLoading,
    error,
    hasPermission,
    isDemoMode,
    startStream,
    startDemoSimulation,
    stopStream,
    switchDevice,
    refreshDevices,
  };
}
