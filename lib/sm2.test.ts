import { describe, expect, it } from 'vitest';

import { calculateSM2 } from './sm2';

describe('calculateSM2', () => {
  it('resets interval to 1 day on poor recall (quality < 3)', () => {
    const result = calculateSM2({
      quality: 1,
      previousEaseFactor: 2.5,
      previousIntervalDays: 6,
    });

    expect(result.intervalDays).toBe(1);
  });

  it('sets a 6-day interval on the first successful review', () => {
    const result = calculateSM2({
      quality: 5,
      previousEaseFactor: 2.5,
      previousIntervalDays: 0,
    });

    expect(result.intervalDays).toBe(6);
  });

  it('grows the interval using the ease factor on subsequent successful reviews', () => {
    const result = calculateSM2({
      quality: 5,
      previousEaseFactor: 2.5,
      previousIntervalDays: 6,
    });

    expect(result.intervalDays).toBe(Math.round(6 * result.easeFactor));
  });

  it('never lets the ease factor drop below 1.3', () => {
    const result = calculateSM2({
      quality: 0,
      previousEaseFactor: 1.3,
      previousIntervalDays: 6,
    });

    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('increases the ease factor on a perfect recall (quality 5)', () => {
    const result = calculateSM2({
      quality: 5,
      previousEaseFactor: 2.5,
      previousIntervalDays: 6,
    });

    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it('sets nextReviewAt to a future date matching intervalDays', () => {
    const result = calculateSM2({
      quality: 5,
      previousEaseFactor: 2.5,
      previousIntervalDays: 0,
    });

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + result.intervalDays);

    expect(result.nextReviewAt.toDateString()).toBe(expectedDate.toDateString());
  });
});
