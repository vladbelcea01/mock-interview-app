import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { initialsOf } from '../shared/initials';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  template: `
    <mat-toolbar class="toolbar">
      @if (isHandset()) {
        <button mat-icon-button aria-label="Toggle navigation" (click)="drawer.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a routerLink="/dashboard" class="brand">
        <mat-icon>record_voice_over</mat-icon>
        <span class="brand-text">Mock Interview Studio</span>
      </a>
      <form class="search" (ngSubmit)="search()" role="search">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          name="q"
          [(ngModel)]="query"
          placeholder="Search participants, sessions, feedback…"
          aria-label="Global search"
        />
      </form>
      <button
        type="button"
        class="user-button"
        [matMenuTriggerFor]="userMenu"
        [attr.aria-label]="'Account menu for ' + (auth.user()?.name ?? '')"
      >
        <span class="avatar" aria-hidden="true">{{ initials() }}</span>
        <span class="user-name">{{ auth.user()?.name }}</span>
      </button>
      <mat-menu #userMenu="matMenu">
        <div class="menu-header">
          <strong>{{ auth.user()?.name }}</strong>
          <span class="muted">{{ auth.user()?.email }}</span>
          <span class="role">{{ auth.isAdmin() ? 'Admin' : 'Interviewer' }}</span>
        </div>
        <button mat-menu-item (click)="auth.logout()"><mat-icon>logout</mat-icon>Sign out</button>
      </mat-menu>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav
        #drawer
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset()"
        class="sidenav"
      >
        <mat-nav-list (click)="isHandset() && drawer.close()">
          @for (item of nav; track item.path) {
            <a mat-list-item [routerLink]="item.path" routerLinkActive="active" #rla="routerLinkActive" [activated]="rla.isActive">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
        <p class="scope muted">{{ scopeLabel() }}</p>
      </mat-sidenav>
      <mat-sidenav-content>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100vh; }
    .toolbar { position: sticky; top: 0; z-index: 2; gap: 12px; background: #fff; border-bottom: 1px solid var(--app-border); }
    .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; font-weight: 600; font-size: 1.05rem; }
    .brand mat-icon { color: var(--mat-sys-primary); }
    .search { flex: 1; max-width: 520px; margin: 0 auto; display: flex; align-items: center; gap: 6px;
      background: var(--app-bg); border: 1px solid var(--app-border); border-radius: 999px; padding: 4px 14px; }
    .search input { border: 0; background: transparent; outline: none; width: 100%; font: inherit; font-size: 0.9rem; padding: 6px 0; }
    .search-icon { color: var(--app-muted); font-size: 20px; width: 20px; height: 20px; }
    .container { flex: 1; background: var(--app-bg); }
    .sidenav { width: 220px; border-right: 1px solid var(--app-border); background: #fff; }
    .active { background: var(--mat-sys-secondary-container); border-radius: 999px; }
    .scope { padding: 0 24px; font-size: 0.8rem; }
    .menu-header { display: flex; flex-direction: column; padding: 8px 16px 12px; gap: 2px; }
    .user-button { display: inline-flex; align-items: center; gap: 10px; height: 44px; padding: 4px 14px 4px 4px;
      border: 1px solid transparent; border-radius: 999px; background: transparent; color: inherit;
      font: inherit; font-size: 0.95rem; font-weight: 500; cursor: pointer; flex-shrink: 0; }
    .user-button:hover { background: var(--app-bg); border-color: var(--app-border); }
    .user-button:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: 2px; }
    .avatar { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); font-size: 0.8rem; font-weight: 600;
      letter-spacing: 0.02em; }
    .role { font-size: 0.75rem; font-weight: 600; color: var(--mat-sys-primary); text-transform: uppercase; }
    @media (max-width: 720px) {
      .brand-text, .user-name { display: none; }
      .user-button { padding: 4px; }
    }
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  protected readonly initials = computed(() => initialsOf(this.auth.user()?.name));
  protected readonly scopeLabel = computed(() =>
    this.auth.isAdmin() ? 'Viewing all interviewers' : 'Viewing your interviews',
  );
  protected query = '';
  protected readonly nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'insights' },
    { path: '/sessions', label: 'Sessions', icon: 'event_note' },
    { path: '/participants', label: 'Participants', icon: 'groups' },
  ];

  protected search(): void {
    const q = this.query.trim();
    void this.router.navigate(['/search'], { queryParams: { q } });
  }
}
