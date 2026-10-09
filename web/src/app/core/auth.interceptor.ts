import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const UNREACHABLE = 'Cannot reach the server. It may be waking up, please try again in a few seconds.';

/** Attaches the JWT to API calls and turns API errors into one consistent user-facing message. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const snackBar = inject(MatSnackBar);
  const isApi = req.url.startsWith(environment.apiUrl);
  const token = isApi ? auth.token() : null;
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && isApi) {
        const isAuthCall = req.url.includes('/auth/login') || req.url.includes('/auth/register');
        if (err.status === 401) {
          // A failed sign-in is shown inline by the login form; anywhere else the session has expired.
          if (!isAuthCall) auth.logout();
        } else if (err.status === 0) {
          snackBar.open(UNREACHABLE, 'Dismiss', { duration: 6000 });
        } else {
          const message = (err.error as { message?: string | string[] } | null)?.message;
          const text = Array.isArray(message) ? message.join('. ') : (message ?? 'Something went wrong');
          snackBar.open(text, 'Dismiss', { duration: 5000 });
        }
      }
      return throwError(() => err);
    }),
  );
};
