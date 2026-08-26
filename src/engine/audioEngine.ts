// ==========================================
// Web Audio Engine — MP3 Sound Effects + Synthesized Chimes
// Plays actual sound files for eye-closed & phone-detected alerts
// Looping playback until the condition clears
// ==========================================

import { WarningSeverity } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;

  // ---- MP3 looping alarm state ----
  private eyeClosedAudio: HTMLAudioElement | null = null;
  private phoneAlertAudio: HTMLAudioElement | null = null;
  private lookingAwayAudio: HTMLAudioElement | null = null;
  // ---- Synthesized Ambient Rain State ----
  private ambientMasterGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientDropTimer: any = null;
  private ambientCurrentVolume = 0.5;

  private isEyeAlarmActive = false;
  private isPhoneAlarmActive = false;
  private isLookingAwayAlarmActive = false;
  private isAmbientPlayingActive = false;

  // Pre-load audio elements for instant playback
  private preloaded = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Pre-load all sound files so they play instantly on first trigger.
   * Called once after first user interaction (to satisfy browser autoplay policy).
   */
  preloadSounds() {
    if (this.preloaded) return;

    this.eyeClosedAudio = new Audio('/sounds/eye-closed-alert.mp3');
    this.eyeClosedAudio.loop = true;
    this.eyeClosedAudio.preload = 'auto';
    this.eyeClosedAudio.load();

    this.phoneAlertAudio = new Audio('/sounds/phone-detected-alert.mp3');
    this.phoneAlertAudio.loop = true;
    this.phoneAlertAudio.preload = 'auto';
    this.phoneAlertAudio.load();

    this.lookingAwayAudio = new Audio('/sounds/chicken-voice.mp3');
    this.lookingAwayAudio.loop = true;
    this.lookingAwayAudio.preload = 'auto';
    this.lookingAwayAudio.load();

    this.preloaded = true;
  }

  // ==================================================================
  // AMBIENT SOUND (Synthesized Procedural Rain)
  // ==================================================================
  private createNoiseBuffer(ctx: AudioContext, durationSec = 6): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSec;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Paul Kellet's filtered pink noise algorithm (-3dB/octave)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.36;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  startAmbientSound(volume: number = 0.5) {
    this.ambientCurrentVolume = Math.max(0, Math.min(1, volume));
    const ctx = this.getContext();
    if (!ctx) return;

    if (this.isAmbientPlayingActive) {
      this.setAmbientVolume(this.ambientCurrentVolume);
      return;
    }

    try {
      const now = ctx.currentTime;

      // Dynamics compressor to ensure rich, full sound without distortion
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, now);
      compressor.knee.setValueAtTime(8, now);
      compressor.ratio.setValueAtTime(3.5, now);
      compressor.attack.setValueAtTime(0.005, now);
      compressor.release.setValueAtTime(0.12, now);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, this.ambientCurrentVolume * 1.1),
        now + 0.3
      );
      masterGain.connect(compressor);
      this.ambientMasterGain = masterGain;

      const noiseBuffer = this.createNoiseBuffer(ctx, 6);

      // Layer 1: Continuous body of rainfall (low/mid rumble & wash)
      const src1 = ctx.createBufferSource();
      src1.buffer = noiseBuffer;
      src1.loop = true;

      const hp1 = ctx.createBiquadFilter();
      hp1.type = 'highpass';
      hp1.frequency.setValueAtTime(140, now);

      const lp1 = ctx.createBiquadFilter();
      lp1.type = 'lowpass';
      lp1.frequency.setValueAtTime(1250, now);

      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(1.15, now);

      // Subtle LFO for natural organic rain intensity modulation
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.12, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.12, now);
      lfo.connect(lfoGain);
      lfoGain.connect(gain1.gain);
      lfo.start(now);

      src1.connect(hp1);
      hp1.connect(lp1);
      lp1.connect(gain1);
      gain1.connect(masterGain);
      src1.start(now);

      // Layer 2: High drizzle / mist texture
      const src2 = ctx.createBufferSource();
      src2.buffer = noiseBuffer;
      src2.loop = true;

      const bp2 = ctx.createBiquadFilter();
      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(3400, now);
      bp2.Q.setValueAtTime(0.85, now);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.65, now);

      src2.connect(bp2);
      bp2.connect(gain2);
      gain2.connect(masterGain);
      src2.start(now);

      this.ambientNodes = [src1, src2, hp1, lp1, gain1, lfo, lfoGain, bp2, gain2, masterGain, compressor];
      this.isAmbientPlayingActive = true;

      // Layer 3: Dynamic soft raindrop scheduler
      const scheduleRaindrop = () => {
        if (!this.isAmbientPlayingActive || !this.ctx || !this.ambientMasterGain) return;
        try {
          const dropNow = this.ctx.currentTime;
          const dropOsc = this.ctx.createOscillator();
          const dropGain = this.ctx.createGain();
          const dropFilter = this.ctx.createBiquadFilter();

          const baseFreq = 1400 + Math.random() * 2800;
          dropOsc.type = 'sine';
          dropOsc.frequency.setValueAtTime(baseFreq, dropNow);
          dropOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, dropNow + 0.04);

          dropFilter.type = 'bandpass';
          dropFilter.frequency.setValueAtTime(baseFreq, dropNow);
          dropFilter.Q.setValueAtTime(8, dropNow);

          const dropVol = 0.15 + Math.random() * 0.18;
          dropGain.gain.setValueAtTime(0.0001, dropNow);
          dropGain.gain.linearRampToValueAtTime(dropVol, dropNow + 0.003);
          dropGain.gain.exponentialRampToValueAtTime(0.0001, dropNow + 0.04);

          dropOsc.connect(dropFilter);
          dropFilter.connect(dropGain);
          dropGain.connect(this.ambientMasterGain);

          dropOsc.start(dropNow);
          dropOsc.stop(dropNow + 0.045);
        } catch {
          // ignore drop errors
        }

        if (this.isAmbientPlayingActive) {
          const nextInterval = 60 + Math.random() * 150;
          this.ambientDropTimer = setTimeout(scheduleRaindrop, nextInterval);
        }
      };

      scheduleRaindrop();
    } catch (e) {
      console.warn('Error starting ambient rain synthesizer:', e);
    }
  }

  stopAmbientSound() {
    if (!this.isAmbientPlayingActive) return;
    this.isAmbientPlayingActive = false;

    if (this.ambientDropTimer) {
      clearTimeout(this.ambientDropTimer);
      this.ambientDropTimer = null;
    }

    if (this.ambientMasterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.ambientMasterGain.gain.setValueAtTime(
          Math.max(0.0001, this.ambientMasterGain.gain.value),
          now
        );
        this.ambientMasterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      } catch {
        // ignore
      }
    }

    const nodesToClean = [...this.ambientNodes];
    this.ambientNodes = [];
    this.ambientMasterGain = null;

    setTimeout(() => {
      nodesToClean.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as any).stop === 'function') {
            (node as any).stop();
          }
          node.disconnect();
        } catch {
          // ignore
        }
      });
    }, 350);
  }

  setAmbientVolume(volume: number) {
    this.ambientCurrentVolume = Math.max(0, Math.min(1, volume));
    if (this.ambientMasterGain && this.ctx) {
      try {
        const target = Math.max(0.0001, this.ambientCurrentVolume * 1.1);
        this.ambientMasterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      } catch {
        // ignore
      }
    }
  }

  get isAmbientPlaying() {
    return this.isAmbientPlayingActive;
  }

  // ==================================================================
  // EYE-CLOSED ALARM — plays MP3 on loop when eye openness < 80%
  // ==================================================================
  startEyeClosedAlarm(volume: number = 0.7) {
    if (this.isEyeAlarmActive) return;
    this.preloadSounds();

    if (!this.eyeClosedAudio) return;
    this.eyeClosedAudio.volume = Math.max(0, Math.min(1, volume));
    this.eyeClosedAudio.currentTime = 0;
    this.eyeClosedAudio.play().catch((e) => console.warn('Eye alarm play error:', e));
    this.isEyeAlarmActive = true;
  }

  stopEyeClosedAlarm() {
    if (!this.isEyeAlarmActive || !this.eyeClosedAudio) return;
    this.eyeClosedAudio.pause();
    this.eyeClosedAudio.currentTime = 0;
    this.isEyeAlarmActive = false;
  }

  get isEyeAlarmPlaying() {
    return this.isEyeAlarmActive;
  }

  // ==================================================================
  // PHONE-DETECTED ALARM — plays MP3 on loop when phone is detected
  // ==================================================================
  startPhoneAlarm(volume: number = 0.7) {
    if (this.isPhoneAlarmActive) return;
    this.preloadSounds();

    if (!this.phoneAlertAudio) return;
    this.phoneAlertAudio.volume = Math.max(0, Math.min(1, volume));
    this.phoneAlertAudio.currentTime = 0;
    this.phoneAlertAudio.play().catch((e) => console.warn('Phone alarm play error:', e));
    this.isPhoneAlarmActive = true;
  }

  stopPhoneAlarm() {
    if (!this.isPhoneAlarmActive || !this.phoneAlertAudio) return;
    this.phoneAlertAudio.pause();
    this.phoneAlertAudio.currentTime = 0;
    this.isPhoneAlarmActive = false;
  }

  get isPhoneAlarmPlaying() {
    return this.isPhoneAlarmActive;
  }

  // ==================================================================
  // LOOKING-AWAY ALARM — plays MP3 on loop when looking away
  // ==================================================================
  startLookingAwayAlarm(volume: number = 0.7) {
    if (this.isLookingAwayAlarmActive) return;
    this.preloadSounds();

    if (!this.lookingAwayAudio) return;
    this.lookingAwayAudio.volume = Math.max(0, Math.min(1, volume));
    this.lookingAwayAudio.currentTime = 0;
    this.lookingAwayAudio.play().catch((e) => console.warn('Looking-away alarm play error:', e));
    this.isLookingAwayAlarmActive = true;
  }

  stopLookingAwayAlarm() {
    if (!this.isLookingAwayAlarmActive || !this.lookingAwayAudio) return;
    this.lookingAwayAudio.pause();
    this.lookingAwayAudio.currentTime = 0;
    this.isLookingAwayAlarmActive = false;
  }

  get isLookingAwayAlarmPlaying() {
    return this.isLookingAwayAlarmActive;
  }

  // ==================================================================
  // ONE-SHOT WARNING CHIMES (synthesized, unchanged)
  // ==================================================================
  playWarningChime(severity: WarningSeverity, volume: number = 0.7, theme: string = 'zen_bell') {
    const ctx = this.getContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume * 0.4)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (severity === 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.8, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 1.2);
    } else if (severity === 2) {
      const freqs = [440, 659.25];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = theme === 'soft_synth' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.7, now + i * 0.15 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.8);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.8);
      });
    } else {
      const freqs = [587.33, 440, 587.33];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.2);

        gain.gain.setValueAtTime(0, now + i * 0.2);
        gain.gain.linearRampToValueAtTime(0.9, now + i * 0.2 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.6);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.6);
      });
    }
  }

  playBreakChime(isStartingBreak: boolean, volume: number = 0.7) {
    const ctx = this.getContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;
    const notes = isStartingBreak ? [523.25, 440.0, 349.23] : [349.23, 440.0, 523.25];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);

      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.6, now + i * 0.18 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 1.0);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 1.0);
    });
  }

  playSessionCompleteFanfare(volume: number = 0.7) {
    const ctx = this.getContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.45, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.16);

      gain.gain.setValueAtTime(0, now + i * 0.16);
      gain.gain.linearRampToValueAtTime(0.8, now + i * 0.16 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + (i === 3 ? 1.8 : 0.8));

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + (i === 3 ? 1.8 : 0.8));
    });
  }

  speakText(text: string, volume: number = 0.8) {
    // Disabled as per user request to remove "the rest of the AI voice"
    return;
  }

  // Stop all looping MP3 alarms
  stopAllLoops() {
    this.stopEyeClosedAlarm();
    this.stopPhoneAlarm();
    this.stopLookingAwayAlarm();
  }
}

export const audioEngine = new AudioEngine();
