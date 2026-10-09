import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'sessions',
        title: 'Sessions',
        loadComponent: () => import('./features/sessions/session-list.component').then((m) => m.SessionListComponent),
      },
      {
        path: 'sessions/new',
        title: 'New session',
        loadComponent: () => import('./features/sessions/session-form.component').then((m) => m.SessionFormComponent),
      },
      {
        path: 'sessions/:id/edit',
        title: 'Edit session',
        loadComponent: () => import('./features/sessions/session-form.component').then((m) => m.SessionFormComponent),
      },
      {
        path: 'sessions/:id',
        title: 'Session',
        loadComponent: () =>
          import('./features/sessions/session-detail.component').then((m) => m.SessionDetailComponent),
      },
      {
        path: 'participants',
        title: 'Participants',
        loadComponent: () =>
          import('./features/participants/participant-list.component').then((m) => m.ParticipantListComponent),
      },
      {
        path: 'participants/:id',
        title: 'Participant',
        loadComponent: () =>
          import('./features/participants/participant-detail.component').then((m) => m.ParticipantDetailComponent),
      },
      {
        path: 'search',
        title: 'Search',
        loadComponent: () => import('./features/search/search.component').then((m) => m.SearchComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
