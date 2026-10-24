import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRecordingSegmentClock, type RecordingSegmentClock } from './recording-clock';

describe('active recording duration and segment budget', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('excludes a pause longer than the server limit from the captured duration', () => {
    const onLimit = vi.fn();
    const clock = createRecordingSegmentClock(onLimit);
    clock.resume();
    vi.advanceTimersByTime(2000);
    clock.pause();
    vi.advanceTimersByTime(900_000);
    expect(clock.durationMs()).toBe(2000);
    expect(onLimit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    clock.resume();
    vi.advanceTimersByTime(1000);
    const capturedDuration = clock.stop();
    expect(capturedDuration).toBe(3000);
    vi.advanceTimersByTime(900_000);
    expect(clock.stop()).toBe(capturedDuration);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('keeps fractional active seconds across repeated pauses for the displayed duration', () => {
    const clock = createRecordingSegmentClock(vi.fn());
    for (let index = 0; index < 5; index++) {
      clock.resume();
      vi.advanceTimersByTime(350);
      clock.pause();
      vi.advanceTimersByTime(10_000);
    }
    expect(clock.durationMs()).toBe(1750);
    expect(Math.floor(clock.durationMs() / 1000)).toBe(1);
    expect(clock.stop()).toBe(1750);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('freezes stop while paused and cannot restart an already captured segment', () => {
    const onLimit = vi.fn();
    const clock = createRecordingSegmentClock(onLimit);
    clock.resume();
    vi.advanceTimersByTime(2500);
    clock.pause();
    vi.advanceTimersByTime(900_000);
    expect(clock.stop()).toBe(2500);
    clock.resume();
    vi.advanceTimersByTime(90_000);
    expect(clock.durationMs()).toBe(2500);
    expect(onLimit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rolls over at 60 active seconds even after multiple resumes', () => {
    const onLimit = vi.fn();
    const clock = createRecordingSegmentClock(onLimit);
    for (let index = 0; index < 3; index++) {
      clock.resume();
      clock.resume();
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(15_000);
      clock.pause();
      vi.advanceTimersByTime(120_000);
    }
    expect(clock.durationMs()).toBe(45_000);
    clock.resume();
    vi.advanceTimersByTime(14_999);
    expect(onLimit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(clock.stop()).toBe(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('gives the next segment its own budget and preserves completed duration through cleanup', () => {
    const captured: number[] = [];
    let nextClock: RecordingSegmentClock | null = null;
    const firstClock = createRecordingSegmentClock(() => {
      captured.push(firstClock.stop());
      nextClock = createRecordingSegmentClock(() => captured.push(nextClock!.stop()));
      nextClock.resume();
    });
    firstClock.resume();
    vi.advanceTimersByTime(60_000);
    expect(captured).toEqual([60_000]);
    expect(vi.getTimerCount()).toBe(1);

    // A delayed media stop callback for segment one must leave segment two alone.
    firstClock.stop();
    vi.advanceTimersByTime(1250);
    const secondClock = nextClock!;
    expect(secondClock.durationMs()).toBe(1250);
    secondClock.pause();
    vi.advanceTimersByTime(90_000);
    secondClock.resume();
    vi.advanceTimersByTime(750);
    captured.push(secondClock.stop());
    expect(captured).toEqual([60_000, 2000]);
    expect(captured.reduce((sum, duration) => sum + duration, 0)).toBe(62_000);
    vi.advanceTimersByTime(60_000);
    expect(captured).toEqual([60_000, 2000]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('uses monotonic capture time even if the wall clock changes', () => {
    const clock = createRecordingSegmentClock(vi.fn());
    clock.resume();
    vi.advanceTimersByTime(1000);
    vi.setSystemTime(Date.now() + 3_600_000);
    vi.advanceTimersByTime(1000);
    expect(clock.stop()).toBe(2000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
