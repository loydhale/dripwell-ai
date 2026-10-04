export interface CameraInitResult {
  stream: MediaStream;
  video: HTMLVideoElement;
  cleanup: () => void;
}

export async function initCamera(video: HTMLVideoElement): Promise<CameraInitResult> {
  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await video.play();

  const cleanup = () => {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  return { stream, video, cleanup };
}

export function captureFrame(video: HTMLVideoElement, targetCanvas?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2d context from canvas');
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement, mimeType = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      mimeType,
      quality
    );
  });
}

export function computeBrightness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const sampleW = Math.floor(canvas.width * 0.3);
  const sampleH = Math.floor(canvas.height * 0.3);
  const startX = Math.floor((canvas.width - sampleW) / 2);
  const startY = Math.floor((canvas.height - sampleH) / 2);

  const imageData = ctx.getImageData(startX, startY, sampleW, sampleH);
  const data = imageData.data;
  let total = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    total += luminance;
    count += 1;
  }

  return count > 0 ? total / count : 0;
}

export function getBrightnessLabel(brightness: number): 'good' | 'fair' | 'poor' {
  if (brightness >= 120) return 'good';
  if (brightness >= 70) return 'fair';
  return 'poor';
}
