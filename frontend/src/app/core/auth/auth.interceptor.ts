import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE } from '../api';
import { AuthService } from './auth.service';

/**
 * Attaches the bearer token to every backend call. A 401 on an authenticated call means
 * the token expired or was revoked, so the user is signed out and sent back to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isApiCall = req.url.startsWith(API_BASE);
  const authed = isApiCall && !!token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && authed !== req) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
