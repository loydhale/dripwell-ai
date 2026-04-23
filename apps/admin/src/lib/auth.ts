interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
}

let currentUser: User | null = null;
let originalUser: User | null = null;
let impersonationClinicName: string | null = null;

const IMPERSONATION_STATE_KEY = 'dw_imp_state';

export function setUser(user: User | null) {
  currentUser = user;
}

export function getUser(): User | null {
  return currentUser;
}

export function isSuperUser(): boolean {
  return currentUser?.role === 'SUPER_USER';
}

export function isVendor(): boolean {
  return currentUser?.role === 'SYSTEM_ADMIN';
}

export function isAdminOrVendor(): boolean {
  return isSuperUser() || isVendor();
}

export function requireAuth(): User {
  if (!currentUser) {
    window.location.hash = '#login';
    throw new Error('Authentication required');
  }
  return currentUser;
}

export function isImpersonating(): boolean {
  return originalUser !== null;
}

export function getImpersonationClinicName(): string | null {
  return impersonationClinicName;
}

export function impersonateStart(user: User, clinicName: string) {
  originalUser = currentUser;
  currentUser = user;
  impersonationClinicName = clinicName;
  try {
    sessionStorage.setItem(IMPERSONATION_STATE_KEY, JSON.stringify({
      originalUser,
      impersonationUser: user,
      clinicName,
    }));
  } catch {
    // ignore
  }
}

export function impersonateStop(): User | null {
  const restored = originalUser;
  currentUser = originalUser;
  originalUser = null;
  impersonationClinicName = null;
  try {
    sessionStorage.removeItem(IMPERSONATION_STATE_KEY);
  } catch {
    // ignore
  }
  return restored;
}

export function initImpersonation() {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_STATE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      originalUser = state.originalUser;
      currentUser = state.impersonationUser;
      impersonationClinicName = state.clinicName;
    }
  } catch {
    // ignore
  }
}
