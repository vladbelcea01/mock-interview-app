import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResult, AuthUser } from './api.models';

const TOKEN_KEY = 'mi.token';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly currentUser = signal<AuthUser | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  token(): string | null {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  }

  login(email: string, password: string): Observable<void> {
    return this.http
      .post<AuthResult>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(map((res) => this.accept(res)));
  }

  register(name: string, email: string, password: string): Observable<void> {
    return this.http
      .post<AuthResult>(`${environment.apiUrl}/auth/register`, { name, email, password })
      .pipe(map((res) => this.accept(res)));
  }

  /** Re-loads the user for a token kept from a previous page load. Emits false if the token is no longer valid. */
  restore(): Observable<boolean> {
    if (!this.token()) return of(false);
    return this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this.currentUser.set(user)),
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  private accept(res: AuthResult): void {
    storage()?.setItem(TOKEN_KEY, res.accessToken);
    this.currentUser.set(res.user);
  }

  private clear(): void {
    storage()?.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
  }
}
