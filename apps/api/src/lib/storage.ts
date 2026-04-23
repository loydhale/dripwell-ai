import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface StoredPhoto {
  url: string;
  key: string;
}

export interface PhotoStorage {
  savePhoto(params: {
    buffer: Buffer;
    angle: string;
    assessmentId: string;
    tenantId: string;
    mimeType: string;
  }): Promise<StoredPhoto>;
}

export class LocalPhotoStorage implements PhotoStorage {
  private baseDir: string;
  private baseUrl: string;

  constructor(opts?: { baseDir?: string; baseUrl?: string }) {
    this.baseDir = opts?.baseDir || join(process.cwd(), 'uploads', 'photos');
    this.baseUrl = opts?.baseUrl || '/uploads/photos';
  }

  async savePhoto(params: {
    buffer: Buffer;
    angle: string;
    assessmentId: string;
    tenantId: string;
    mimeType: string;
  }): Promise<StoredPhoto> {
    const ext = this.extFromMime(params.mimeType);
    const timestamp = Date.now();
    const filename = `${params.assessmentId}_${params.angle}_${timestamp}.${ext}`;
    const relativePath = join(params.tenantId, filename);
    const absolutePath = join(this.baseDir, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.buffer);

    return {
      url: `${this.baseUrl}/${relativePath.replace(/\\/g, '/')}`,
      key: relativePath,
    };
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    return 'bin';
  }
}

let _storage: PhotoStorage | null = null;

export function getPhotoStorage(): PhotoStorage {
  if (!_storage) {
    _storage = new LocalPhotoStorage();
  }
  return _storage;
}

export function setPhotoStorage(storage: PhotoStorage): void {
  _storage = storage;
}
