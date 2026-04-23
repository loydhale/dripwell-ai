interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
}

let currentUser: User | null = null;

export function setUser(user: User | null) {
  currentUser = user;
}

export function getUser(): User | null {
  return currentUser;
}

export function isSuperUser(): boolean {
  return currentUser?.role === 'SUPER_USER';
}

export function requireAuth(): User {
  if (!currentUser) {
    window.location.hash = '#login';
    throw new Error('Authentication required');
  }
  return currentUser;
}
