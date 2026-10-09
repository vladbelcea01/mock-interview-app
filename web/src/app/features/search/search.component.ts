import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { SearchResults } from '../../core/api.models';
import { ReportsApi } from '../../core/reports-api.service';

@Component({
  selector: 'app-search',
  imports: [RouterLink, DatePipe, TitleCasePipe, MatIconModule, MatProgressBarModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Search</h1>
          @if (term()) {
            <p class="subtitle">Results for “{{ term() }}”</p>
          }
        </div>
      </div>
      @if (term().length < 2) {
        <div class="card empty-state">Type at least 2 characters in the search box above.</div>
      } @else {
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (results(); as r) {
          <div class="groups">
            <section class="card">
              <h2><mat-icon>groups</mat-icon>Participants <span class="count">{{ r.participants.length }}</span></h2>
              @for (p of r.participants; track p.id) {
                <a class="hit" [routerLink]="['/participants', p.id]">
                  <strong>{{ p.fullName }}</strong><span class="muted">{{ p.email }}</span>
                </a>
              } @empty {
                <p class="muted">No participants found.</p>
              }
            </section>
            <section class="card">
              <h2><mat-icon>event_note</mat-icon>Sessions <span class="count">{{ r.sessions.length }}</span></h2>
              @for (s of r.sessions; track s.id) {
                <a class="hit" [routerLink]="['/sessions', s.id]">
                  <strong>{{ s.title }}</strong>
                  <span class="muted">{{ s.participantName }} · {{ s.scheduledAt | date: 'd MMM y' }} · {{ s.status | titlecase }}</span>
                </a>
              } @empty {
                <p class="muted">No sessions found.</p>
              }
            </section>
            <section class="card">
              <h2><mat-icon>rate_review</mat-icon>Feedback <span class="count">{{ r.feedback.length }}</span></h2>
              @for (f of r.feedback; track f.sessionId) {
                <a class="hit" [routerLink]="['/sessions', f.sessionId]">
                  <strong>{{ f.sessionTitle }}</strong>
                  <span class="muted">{{ f.participantName }}</span>
                  <span class="snippet">{{ f.snippet }}</span>
                </a>
              } @empty {
                <p class="muted">No feedback mentions this.</p>
              }
            </section>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .groups { display: grid; gap: 16px; }
    h2 { display: flex; align-items: center; gap: 8px; font-size: 1rem; margin: 0 0 8px; }
    .count { margin-left: auto; color: var(--app-muted); font-weight: 500; }
    .hit { display: flex; flex-direction: column; gap: 2px; padding: 10px 8px; border-radius: 8px; text-decoration: none; color: inherit; }
    .hit:hover { background: var(--app-bg); }
    .snippet { font-size: 0.85rem; font-style: italic; }
  `,
})
export class SearchComponent {
  /** Bound from the ?q= query parameter. */
  readonly q = input<string>('');
  private readonly api = inject(ReportsApi);
  protected readonly term = signal('');
  protected readonly results = signal<SearchResults | null>(null);
  protected readonly loading = signal(false);

  constructor() {
    effect(() => {
      const term = (this.q() ?? '').trim();
      untracked(() => this.run(term));
    });
  }

  private run(term: string): void {
    this.term.set(term);
    this.results.set(null);
    if (term.length < 2) return;
    this.loading.set(true);
    this.api.search(term).subscribe({
      next: (r) => {
        this.results.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
