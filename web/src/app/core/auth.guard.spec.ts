import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/sessions' } as RouterStateSnapshot),
    );

  function setup(auth: Partial<AuthService>) {
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
  }

  it('allows navigation when a user is loaded', () => {
    setup({ isLoggedIn: () => true, token: () => 'abc' } as Partial<AuthService>);
    expect(run()).toBe(true);
  });

  it('redirects to /login when there is no token', () => {
    setup({ isLoggedIn: () => false, token: () => null } as Partial<AuthService>);
    const result = run() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fsessions');
  });

  it('restores the session from a stored token before allowing navigation', async () => {
    setup({ isLoggedIn: () => false, token: () => 'abc', restore: () => of(true) } as Partial<AuthService>);
    const result = await new Promise((resolve) => (run() as Observable<boolean | UrlTree>).subscribe(resolve));
    expect(result).toBe(true);
  });

  it('redirects to /login when the stored token is rejected', async () => {
    setup({ isLoggedIn: () => false, token: () => 'expired', restore: () => of(false) } as Partial<AuthService>);
    const result = await new Promise<UrlTree>((resolve) =>
      (run() as Observable<UrlTree>).subscribe((r) => resolve(r)),
    );
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fsessions');
  });
});
