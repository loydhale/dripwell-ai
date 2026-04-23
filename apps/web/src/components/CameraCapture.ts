import { initCamera, captureFrame, canvasToBlob, computeBrightness, getBrightnessLabel } from '../lib/camera.js';
import { uploadPhoto } from '../lib/upload.js';
import { createARGuideOverlay, updateLightingIndicator, type ARGuideOverlayElements, type PhotoAngle } from './ARGuideOverlay.js';

export interface CameraCaptureState {
  angle: PhotoAngle;
  assessmentId: string;
  apiBaseUrl?: string;
  token?: string;
}

export interface CameraCaptureHandlers {
  onComplete: (angle: PhotoAngle, result: { ok: boolean; photoCapture?: unknown }) => void;
  onSkip?: (angle: PhotoAngle) => void;
}

export function renderCameraCapture(
  container: HTMLElement,
  state: CameraCaptureState,
  handlers: CameraCaptureHandlers
): () => void {
  let cleanupFn: (() => void) | null = null;
  let overlayElements: ARGuideOverlayElements | null = null;
  let lightingInterval: number | null = null;
  let capturedBlob: Blob | null = null;
  let isUploading = false;

  container.innerHTML = '';
  container.className = 'camera-capture-root';

  const video = document.createElement('video');
  video.className = 'camera-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  const previewImg = document.createElement('img');
  previewImg.className = 'camera-preview-img';
  previewImg.style.display = 'none';

  const overlayContainer = document.createElement('div');
  overlayContainer.className = 'camera-overlay-container';

  const controls = document.createElement('div');
  controls.className = 'camera-controls';

  const captureBtn = document.createElement('button');
  captureBtn.className = 'camera-btn-capture';
  captureBtn.setAttribute('aria-label', 'Capture photo');

  const retakeBtn = document.createElement('button');
  retakeBtn.className = 'camera-btn-retake';
  retakeBtn.textContent = 'Retake';
  retakeBtn.style.display = 'none';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'camera-btn-confirm';
  confirmBtn.textContent = 'Use this photo';
  confirmBtn.style.display = 'none';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'camera-btn-skip';
  skipBtn.textContent = 'Skip';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'camera-progress-wrap';
  progressWrap.style.display = 'none';

  const progressBar = document.createElement('div');
  progressBar.className = 'camera-progress-bar';

  const progressLabel = document.createElement('div');
  progressLabel.className = 'camera-progress-label';

  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(progressLabel);

  const errorMsg = document.createElement('div');
  errorMsg.className = 'camera-error-msg';
  errorMsg.style.display = 'none';

  controls.appendChild(captureBtn);
  controls.appendChild(retakeBtn);
  controls.appendChild(confirmBtn);
  controls.appendChild(skipBtn);
  controls.appendChild(progressWrap);
  controls.appendChild(errorMsg);

  container.appendChild(video);
  container.appendChild(previewImg);
  container.appendChild(overlayContainer);
  container.appendChild(controls);

  overlayElements = createARGuideOverlay(state.angle);
  overlayContainer.appendChild(overlayElements.root);

  function setCaptureMode() {
    video.style.display = '';
    previewImg.style.display = 'none';
    captureBtn.style.display = '';
    retakeBtn.style.display = 'none';
    confirmBtn.style.display = 'none';
    progressWrap.style.display = 'none';
    errorMsg.style.display = 'none';
    capturedBlob = null;
    if (overlayElements) {
      overlayElements.guideSvg.style.display = '';
      overlayElements.instructionLabel.style.display = '';
    }
  }

  function setPreviewMode() {
    video.style.display = 'none';
    previewImg.style.display = '';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = '';
    confirmBtn.style.display = '';
    progressWrap.style.display = 'none';
    errorMsg.style.display = 'none';
    if (overlayElements) {
      overlayElements.guideSvg.style.display = 'none';
      overlayElements.instructionLabel.style.display = 'none';
    }
  }

  function setUploadingMode() {
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'none';
    confirmBtn.style.display = 'none';
    progressWrap.style.display = '';
    errorMsg.style.display = 'none';
  }

  function setError(text: string) {
    errorMsg.textContent = text;
    errorMsg.style.display = '';
    progressWrap.style.display = 'none';
    captureBtn.style.display = '';
    retakeBtn.style.display = 'none';
    confirmBtn.style.display = 'none';
    isUploading = false;
  }

  async function startCamera() {
    try {
      const camera = await initCamera(video);
      cleanupFn = camera.cleanup;

      lightingInterval = window.setInterval(() => {
        if (!video.videoWidth || video.style.display === 'none') return;
        try {
          const canvas = captureFrame(video);
          const brightness = computeBrightness(canvas);
          const label = getBrightnessLabel(brightness);
          if (overlayElements) {
            updateLightingIndicator(overlayElements, brightness, label);
          }
        } catch {
          // ignore sampling errors
        }
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      errorMsg.textContent = `Camera error: ${msg}. Check permissions and try again.`;
      errorMsg.style.display = '';
      captureBtn.disabled = true;
    }
  }

  captureBtn.addEventListener('click', async () => {
    if (!video.videoWidth) return;
    try {
      const canvas = captureFrame(video);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      capturedBlob = blob;
      const url = URL.createObjectURL(blob);
      previewImg.src = url;
      setPreviewMode();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    }
  });

  retakeBtn.addEventListener('click', () => {
    if (previewImg.src) {
      URL.revokeObjectURL(previewImg.src);
      previewImg.src = '';
    }
    setCaptureMode();
  });

  confirmBtn.addEventListener('click', async () => {
    if (!capturedBlob || isUploading) return;
    isUploading = true;
    setUploadingMode();

    const result = await uploadPhoto({
      assessmentId: state.assessmentId,
      angle: state.angle,
      blob: capturedBlob,
      apiBaseUrl: state.apiBaseUrl,
      token: state.token,
      onProgress: (p) => {
        progressBar.style.width = `${p.percent}%`;
        progressLabel.textContent = `Uploading ${p.percent}%`;
      },
    });

    isUploading = false;

    if (result.ok) {
      handlers.onComplete(state.angle, { ok: true, photoCapture: result.photoCapture });
    } else {
      setError(result.error || 'Upload failed. Tap capture to try again.');
      if (previewImg.src) {
        URL.revokeObjectURL(previewImg.src);
        previewImg.src = '';
      }
      setCaptureMode();
    }
  });

  skipBtn.addEventListener('click', () => {
    if (handlers.onSkip) {
      handlers.onSkip(state.angle);
    }
  });

  startCamera();

  return () => {
    if (lightingInterval !== null) {
      clearInterval(lightingInterval);
      lightingInterval = null;
    }
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }
    if (previewImg.src) {
      URL.revokeObjectURL(previewImg.src);
    }
  };
}
