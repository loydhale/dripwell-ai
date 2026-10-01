'use client';

import { useEffect, useRef, useState } from 'react';
import { ErrorBanner, Icon } from './ui';
import { useClinic } from './clinic-context';

type CapturePhase = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopping';

export function AudioRecorder({
  consented,
  onSegment,
  label = 'Consultation recording',
  continuous = true,
}: {
  consented: boolean;
  onSegment: (
    audio: File,
    segmentId: string,
    sequence: number,
    durationMs: number,
  ) => Promise<void>;
  label?: string;
  continuous?: boolean;
}) {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<
    { file: File; id: string; sequence: number; duration: number }[]
  >([]);
  const { setCaptureBusy } = useClinic();
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const active = useRef(false);
  const paused = useRef(false);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;
  useEffect(() => {
    setCaptureBusy(phase !== 'idle' || pending > 0 || failed.length > 0);
    return () => setCaptureBusy(false);
  }, [phase, pending, failed.length, setCaptureBusy]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (active.current || pending || failed.length) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [pending, failed.length]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = false;
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      if (recorder.current?.state !== 'inactive') recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function upload(segment: { file: File; id: string; sequence: number; duration: number }) {
    setPending((value) => value + 1);
    try {
      await onSegmentRef.current(segment.file, segment.id, segment.sequence, segment.duration);
    } catch (cause) {
      setFailed((items) => [...items.filter((item) => item.id !== segment.id), segment]);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Recording could not be processed. Keep this page open and retry.',
      );
    } finally {
      setPending((value) => value - 1);
    }
  }
  function release() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function captureSegment() {
    if (!stream.current || !active.current) return;
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const instance = new MediaRecorder(stream.current, {
      audioBitsPerSecond: 64000,
      ...(mime ? { mimeType: mime } : {}),
    });
    recorder.current = instance;
    const chunks: BlobPart[] = [];
    const id = crypto.randomUUID();
    const segmentSequence = sequence.current++;
    const started = Date.now();
    instance.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    instance.onerror = () => {
      active.current = false;
      release();
      setPhase('idle');
      setError(
        'Audio capture was interrupted. Review saved segments and record any missing information.',
      );
    };
    instance.onstop = () => {
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      const blob = new Blob(chunks, { type: instance.mimeType || 'audio/webm' });
      if (blob.size) {
        const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
        void upload({
          file: new File([blob], `recording-${id}.${extension}`, { type: blob.type }),
          id,
          sequence: segmentSequence,
          duration: Date.now() - started,
        });
      }
      if (active.current && continuous) captureSegment();
      else {
        active.current = false;
        release();
        setPhase('idle');
      }
    };
    instance.start();
    if (paused.current) instance.pause();
    segmentTimer.current = setTimeout(() => {
      if (instance.state === 'paused') return;
      if (!continuous) active.current = false;
      if (instance.state !== 'inactive') instance.stop();
    }, 60000);
  }
  async function start() {
    setError('');
    if (!consented) {
      setError("Record the client's consent before capturing audio.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(
        'Recording is unavailable in this browser. Use a supported browser over HTTPS or enter notes manually.',
      );
      return;
    }
    setPhase('requesting');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true },
        video: false,
      });
      if (!mounted.current) {
        release();
        return;
      }
      stream.current.getAudioTracks().forEach((track) =>
        track.addEventListener(
          'ended',
          () => {
            if (!active.current) return;
            active.current = false;
            if (recorder.current?.state !== 'inactive') recorder.current?.stop();
            setError(
              'The microphone was interrupted. Review saved segments and enter any missing conversation details.',
            );
          },
          { once: true },
        ),
      );
      active.current = true;
      paused.current = false;
      setSeconds(0);
      setPhase('recording');
      captureSegment();
    } catch (cause) {
      setPhase('idle');
      release();
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow access in your browser settings or use manual notes.'
          : 'The microphone could not be opened. Check your device and try again.',
      );
    }
  }
  function pause() {
    if (recorder.current?.state === 'recording') {
      recorder.current.pause();
      paused.current = true;
      setPhase('paused');
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
    }
  }
  function resume() {
    if (recorder.current?.state === 'paused') {
      recorder.current.resume();
      paused.current = false;
      setPhase('recording');
      segmentTimer.current = setTimeout(() => {
        if (recorder.current?.state === 'recording') recorder.current.stop();
      }, 60000);
    }
  }
  function stop() {
    active.current = false;
    paused.current = false;
    setPhase('stopping');
    if (segmentTimer.current) clearTimeout(segmentTimer.current);
    if (recorder.current?.state !== 'inactive') recorder.current?.stop();
    else {
      release();
      setPhase('idle');
    }
  }
  return (
    <div className="recorder">
      <div className="recorder-main">
        <span className={`mic-orb ${phase === 'recording' ? 'is-recording' : ''}`}>
          <Icon name="mic" size={22} />
        </span>
        <div>
          <strong>{label}</strong>
          <p>
            {phase === 'recording'
              ? 'Recording. Audio is saved in ordered segments.'
              : phase === 'paused'
                ? 'Paused. The microphone is not recording.'
                : phase === 'requesting'
                  ? 'Waiting for microphone permission…'
                  : pending
                    ? 'Uploading and processing audio. Keep this page open.'
                    : 'Record with consent, or enter the conversation below.'}
          </p>
        </div>
        <span className="recorder-time">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="recorder-actions">
        {phase === 'idle' ? (
          <button
            className="button button-small button-primary"
            type="button"
            disabled={!consented}
            onClick={() => void start()}
          >
            <Icon name="mic" size={16} />
            {continuous ? 'Start recording' : 'Record voice message'}
          </button>
        ) : phase === 'recording' || phase === 'paused' ? (
          <>
            <button
              className="button button-small"
              type="button"
              onClick={phase === 'paused' ? resume : pause}
            >
              <Icon name={phase === 'paused' ? 'mic' : 'pause'} size={16} />
              {phase === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button className="button button-small button-coral" type="button" onClick={stop}>
              <Icon name="stop" size={15} />
              Stop & save
            </button>
          </>
        ) : (
          <span className="small muted">
            {phase === 'stopping' ? 'Saving recording…' : 'Opening microphone…'}
          </span>
        )}
        {pending ? (
          <span className="small muted">
            {pending} segment{pending === 1 ? '' : 's'} processing
          </span>
        ) : null}
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {failed.length ? (
        <button
          className="button button-small"
          type="button"
          onClick={() => {
            const retry = [...failed];
            setFailed([]);
            setError('');
            retry.forEach((item) => void upload(item));
          }}
        >
          Retry {failed.length} unsaved segment{failed.length === 1 ? '' : 's'}
        </button>
      ) : null}
      {failed.length ? (
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setFailed([]);
            setError(
              'Unsaved local audio was discarded. Review the saved transcript and manually document any missing information.',
            );
          }}
        >
          Discard unsaved local audio
        </button>
      ) : null}
    </div>
  );
}
