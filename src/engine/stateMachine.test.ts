import { describe, it, expect, beforeEach } from 'vitest';
import { StudyStateMachine } from './stateMachine';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from '../utils/constants';
import { RawVisionFrame } from '../types';

describe('StudyStateMachine', () => {
  let stateMachine: StudyStateMachine;
  let baseFrame: RawVisionFrame;

  beforeEach(() => {
    stateMachine = new StudyStateMachine(DEFAULT_SETTINGS, DEFAULT_CALIBRATION);
    baseFrame = {
      timestamp: 10000,
      isFaceDetected: true,
      ear: 0.28,
      eyeOpenness: 100,
      isEyeClosed: false,
      headPitch: 5,
      headYaw: 0,
      headRoll: 0,
      isLookingAway: false,
      isHeadDropped: false,
      gazeX: 0,
      gazeY: 0,
      isPersonDetected: true,
      isSlouching: false,
      postureScore: 90,
      shoulderSlope: 0,
      shoulderDistance: 180,
      movementMagnitude: 5,
      phoneDetected: false,
      phoneConfidence: 0,
      phoneInHand: false,
      lightingScore: 85,
      lightingCondition: 'good',
    };
  });

  it('maintains STUDYING state when frames are neutral', () => {
    const status = stateMachine.processFrame(baseFrame);
    expect(status.currentState).toBe('STUDYING');
    expect(status.statusLevel).toBe('focused');
  });

  it('absorbs single-frame blinks without switching to DROWSY', () => {
    // Neutral study frame
    stateMachine.processFrame({ ...baseFrame, timestamp: 10000 });

    // Single blink frame (ear dropped, eye closed)
    const blinkFrame: RawVisionFrame = {
      ...baseFrame,
      timestamp: 10100,
      ear: 0.12,
      eyeOpenness: 15,
      isEyeClosed: true,
    };
    const status = stateMachine.processFrame(blinkFrame);
    expect(status.currentState).toBe('STUDYING'); // single blink absorbed by duration threshold
  });

  it('transitions to DROWSY only after sustained eye closure (>= 3.5s)', () => {
    let t = 10000;
    // Feed 3.4 seconds of eye closure
    for (let i = 0; i < 34; i++) {
      t += 100;
      stateMachine.processFrame({
        ...baseFrame,
        timestamp: t,
        ear: 0.12,
        eyeOpenness: 10,
        isEyeClosed: true,
      });
    }
    // At 3.4s, should not have triggered yet
    let status = stateMachine.processFrame({
      ...baseFrame,
      timestamp: t,
      ear: 0.12,
      eyeOpenness: 10,
      isEyeClosed: true,
    });
    expect(status.currentState).toBe('STUDYING');

    // Reach 3.6 seconds
    t += 200;
    status = stateMachine.processFrame({
      ...baseFrame,
      timestamp: t,
      ear: 0.12,
      eyeOpenness: 10,
      isEyeClosed: true,
    });
    expect(status.currentState).toBe('DROWSY');
    expect(status.statusLevel).toBe('needs_attention');
  });

  it('requires 15s sustained recovery before returning to STUDYING', () => {
    let t = 10000;
    // Enter DROWSY
    for (let i = 0; i < 40; i++) {
      t += 100;
      stateMachine.processFrame({
        ...baseFrame,
        timestamp: t,
        ear: 0.12,
        eyeOpenness: 10,
        isEyeClosed: true,
      });
    }

    // Now user opens eyes (neutral frames for 10s)
    for (let i = 0; i < 100; i++) {
      t += 100;
      const st = stateMachine.processFrame({ ...baseFrame, timestamp: t });
      expect(st.currentState).toBe('DROWSY'); // hysteresis: still recovering
    }

    // Reach 16s of continuous neutral frames
    for (let i = 0; i < 60; i++) {
      t += 100;
      stateMachine.processFrame({ ...baseFrame, timestamp: t });
    }
    const recoveredStatus = stateMachine.processFrame({ ...baseFrame, timestamp: t });
    expect(recoveredStatus.currentState).toBe('STUDYING');
  });

  it('honors manual BREAK override immediately', () => {
    stateMachine.setBreakOverride(true);
    const status = stateMachine.processFrame(baseFrame);
    expect(status.currentState).toBe('BREAK');
    expect(status.displayLabel).toBe('On Break');
  });
});
