import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WarningEngine } from './warningEngine';
import { DEFAULT_SETTINGS } from '../utils/constants';

describe('WarningEngine', () => {
  let warningEngine: WarningEngine;

  beforeEach(() => {
    warningEngine = new WarningEngine(DEFAULT_SETTINGS);
  });

  it('suppresses alerts when in BREAK or STUDYING state', () => {
    const r1 = warningEngine.evaluateState('STUDYING', 10, false);
    expect(r1).toBeNull();

    const r2 = warningEngine.evaluateState('DROWSY', 10, true); // on break
    expect(r2).toBeNull();
  });

  it('triggers Level 1 on first alert and respects 20s cooldown', () => {
    const alert1 = warningEngine.evaluateState('PHONE_USAGE', 5, false);
    expect(alert1).not.toBeNull();
    expect(alert1?.severity).toBe(1);
    expect(alert1?.category).toBe('PHONE_USAGE');

    // Immediate second evaluation within cooldown window (e.g. 5s later)
    const alert2 = warningEngine.evaluateState('PHONE_USAGE', 10, false);
    expect(alert2).toBeNull(); // blocked by cooldown
  });

  it('escalates severity to Level 2 and Level 3 on repeated distractions in the same category', () => {
    // 1st warning
    const w1 = warningEngine.evaluateState('DROWSY', 5, false);
    expect(w1?.severity).toBe(1);

    // Fast-forward cooldown by updating settings or manual evaluation
    warningEngine.updateSettings({ ...DEFAULT_SETTINGS, alertCooldownSec: 0 });

    // 2nd warning
    const w2 = warningEngine.evaluateState('DROWSY', 10, false);
    expect(w2?.severity).toBe(2);

    // 3rd warning
    const w3 = warningEngine.evaluateState('DROWSY', 15, false);
    expect(w3?.severity).toBe(3);
  });

  it('isolates categories so different distractions do not stack severity onto each other', () => {
    warningEngine.updateSettings({ ...DEFAULT_SETTINGS, alertCooldownSec: 0 });

    // Drowsy warning (1st time -> Level 1)
    const w1 = warningEngine.evaluateState('DROWSY', 5, false);
    expect(w1?.severity).toBe(1);

    // Phone warning (1st time -> Level 1, does not become Level 2)
    const w2 = warningEngine.evaluateState('PHONE_USAGE', 5, false);
    expect(w2?.severity).toBe(1);
  });
});
