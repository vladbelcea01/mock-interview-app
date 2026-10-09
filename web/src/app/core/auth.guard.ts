import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toLogin = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  if (auth.isLoggedIn()) return true;
  if (!auth.token()) return toLogin();
  return auth.restore().pipe(map((ok) => (ok ? true : toLogin())));
};
