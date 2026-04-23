export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadResult {
  ok: boolean;
  photoCapture?: unknown;
  error?: string;
}

export function uploadPhoto(params: {
  assessmentId: string;
  angle: string;
  blob: Blob;
  apiBaseUrl?: string;
  token?: string;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<UploadResult> {
  return new Promise((resolve) => {
    const { assessmentId, angle, blob, apiBaseUrl, token, onProgress } = params;
    const url = `${apiBaseUrl || ''}/assessments/${assessmentId}/photos`;

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('photo', blob, `${angle}.jpg`);
    formData.append('angle', angle);

    xhr.open('POST', url, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({ ok: true, photoCapture: json.photoCapture });
        } catch {
          resolve({ ok: true });
        }
      } else {
        let error = `Upload failed (${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.error) error = json.error;
        } catch {
          // ignore
        }
        resolve({ ok: false, error });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ ok: false, error: 'Network error during upload' });
    });

    xhr.addEventListener('abort', () => {
      resolve({ ok: false, error: 'Upload aborted' });
    });

    xhr.send(formData);
  });
}
