import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Workspace pages: signed-out visitors go to /login and come back here afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** The login page: a user who is already signed in goes straight to the workspace. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/home']) : true;
};

/** Admin-only pages (issue #69): an officer is bounced to /home. Belt-and-braces, same reasoning
 *  as issue #57's autonomy-level gating — the real boundary is the backend's own
 *  `hasAnyRole("ADMIN", "MANAGER")` on `/api/admin/**`. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canSeeAdminJobs() ? true : inject(Router).createUrlTree(['/home']);
};
