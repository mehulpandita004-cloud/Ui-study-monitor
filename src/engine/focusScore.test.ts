import { describe, it, expect, beforeEach } from 'vitest';
import { FocusScoreEngine } from './focusScore';
import { DEFAULT_SETTINGS } from '../utils/constants';

describe('FocusScoreEngine', () => {
  let engine: FocusScoreEngine;

  beforeEach(() => {
    engine = new FocusScoreEngine(DEFAULT_SETTINGS);
  });

  it('starts at 100 with zero distraction', () => {
    const score = engine.calculate(600, 0, 0, 0, 0, 0, 90);
    expect(score.currentScore).toBe(100);
    expect(score.smoothedScore).toBe(100);
  });

  it('smooths score drops with Exponential Moving Average (EMA)', () => {
    // 50% distraction in a 10 min session
    const s1 = engine.calculate(300, 300, 0, 0, 0, 0, 80);
    // Raw score dropped significantly, but smoothed score drops gradually
    expect(s1.currentScore).toBeLessThan(80);
    expect(s1.smoothedScore).toBeGreaterThan(s1.currentScore);
  });

  it('applies posture bonus when posture quality is high', () => {
    const normal = engine.calculate(600, 60, 0, 0, 0, 0, 75);
    const withBonus = engine.calculate(600, 60, 0, 0, 0, 0, 95);
    expect(withBonus.postureBonus).toBeGreaterThan(0);
    expect(withBonus.currentScore).toBeGreaterThanOrEqual(normal.currentScore);
  });
});
