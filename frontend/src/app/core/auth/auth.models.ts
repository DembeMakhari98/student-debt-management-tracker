import { Officer } from '../models';

export type UserRole = 'OFFICER' | 'MANAGER' | 'ADMIN';

/** The signed-in user, as returned by POST /api/auth/login. */
export interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
  team: string | null;
  officerKey: string | null;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

/** What is kept in storage between page loads. */
export type Session = LoginResponse;

/**
 * The Officer the portfolio scoping in DebtService acts as. An ADMIN has no caseload of
 * their own, so they are treated as a manager-level viewer of every team.
 */
export function officerFor(user: AuthUser): Officer {
  return {
    id: user.officerKey ?? user.username,
    name: user.displayName,
    team: user.team ?? 'All teams',
    role: user.role === 'OFFICER' ? 'officer' : 'manager',
  };
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'MANAGER':
      return 'Debt manager';
    case 'ADMIN':
      return 'System administrator';
    default:
      return 'Student debt officer';
  }
}
