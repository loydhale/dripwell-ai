export const RECORDING_SEGMENT_LIMIT_MS = 60_000;

// Each MediaRecorder owns a clock, so an old stop callback cannot clear the
// next segment's timer. Stopping freezes the duration before media is delivered.
export function createRecordingSegmentClock(onLimit: () => void) {
  let elapsedMs = 0;
  let activeSince: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function elapsed() {
    return elapsedMs + (activeSince === null ? 0 : performance.now() - activeSince);
  }

  function durationMs() {
    return Math.floor(elapsed());
  }

  function pause() {
    elapsedMs = elapsed();
    activeSince = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function stop() {
    pause();
    stopped = true;
    return durationMs();
  }

  function scheduleLimit() {
    timer = setTimeout(
      () => {
        timer = null;
        if (elapsed() < RECORDING_SEGMENT_LIMIT_MS) {
          scheduleLimit();
          return;
        }
        stop();
        onLimit();
      },
      Math.max(0, Math.ceil(RECORDING_SEGMENT_LIMIT_MS - elapsed())),
    );
  }

  function resume() {
    if (stopped || activeSince !== null) return;
    activeSince = performance.now();
    scheduleLimit();
  }

  return { durationMs, pause, resume, stop };
}

export type RecordingSegmentClock = ReturnType<typeof createRecordingSegmentClock>;
