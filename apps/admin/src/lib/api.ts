const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setToken(null);
    window.location.hash = '#login';
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 403) {
    throw new Error('Access denied. Super user access required.');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const json = await response.json();
      if (json.error) message = json.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401) {
    setToken(null);
    window.location.hash = '#login';
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 403) {
    throw new Error('Access denied. Super user access required.');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const json = await response.json();
      if (json.error) message = json.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function del<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' });
}
