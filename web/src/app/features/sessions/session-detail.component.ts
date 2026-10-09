import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { FeedbackInput, RECOMMENDATION_LABELS, SessionDetail, SKILLS, TYPE_LABELS } from '../../core/api.models';
import { SessionsApi } from '../../core/sessions-api.service';
import { ConfirmData, ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { FeedbackFormComponent } from './feedback-form.component';

@Component({
  selector: 'app-session-detail',
  imports: [RouterLink, DatePipe, TitleCasePipe, MatButtonModule, MatIconModule, FeedbackFormComponent],
  template: `
    <div class="page">
      @if (session(); as s) {
        <div class="page-header">
          <div>
            <a routerLink="/sessions" class="back"><mat-icon>arrow_back</mat-icon>Sessions</a>
            <h1>{{ s.title }}</h1>
            <p class="subtitle">
              <span class="status-chip" [class]="statusClass()">{{ statusLabel() }}</span>
              {{ typeLabels[s.type] }} · {{ s.scheduledAt | date: 'EEEE d MMMM y, HH:mm' }} · {{ s.durationMin }} min
            </p>
          </div>
          <div class="actions">
            @if (s.status === 'SCHEDULED') {
              <a mat-stroked-button [routerLink]="['/sessions', s.id, 'edit']"><mat-icon>edit</mat-icon>Edit</a>
              <button mat-stroked-button (click)="cancel()"><mat-icon>event_busy</mat-icon>Cancel</button>
              <button mat-flat-button (click)="complete()"><mat-icon>task_alt</mat-icon>Mark completed</button>
            } @else {
              <a mat-stroked-button [routerLink]="['/sessions', s.id, 'edit']"><mat-icon>edit_note</mat-icon>Edit notes</a>
            }
          </div>
        </div>

        <div class="grid-2 top">
          <div class="card">
            <h2>Participant</h2>
            <a [routerLink]="['/participants', s.participant.id]" class="person">
              <strong>{{ s.participant.fullName }}</strong>
              <span class="muted">{{ s.participant.targetRole }} · {{ s.participant.seniority | titlecase }}</span>
            </a>
          </div>
          <div class="card">
            <h2>Interviewer</h2>
            <strong>{{ s.interviewer.name }}</strong>
            <div class="muted">{{ s.interviewer.email }}</div>
          </div>
        </div>

        @if (s.notes) {
          <div class="card"><h2>Notes</h2><p class="pre">{{ s.notes }}</p></div>
        }

        <div class="card">
          <h2>Feedback</h2>
          @switch (s.status) {
            @case ('SCHEDULED') {
              <p class="muted">Feedback can be recorded once the session is marked completed.</p>
            }
            @case ('CANCELLED') {
              @if (!s.feedback) {
                <p class="muted">This session was cancelled.</p>
              }
            }
            @case ('COMPLETED') {
              @if (s.feedback && !editing()) {
                <div class="feedback-view">
                  <div class="scores">
                    <div class="score big"><span>Overall</span><strong>{{ s.feedback.overallRating }}/5</strong></div>
                    @for (k of skills; track k.key) {
                      <div class="score"><span>{{ k.label }}</span><strong>{{ s.feedback[k.key] }}/5</strong></div>
                    }
                  </div>
                  <p><strong>Recommendation:</strong> {{ recommendationLabels[s.feedback.recommendation] }}</p>
                  <div class="grid-2">
                    <div><h3>Strengths</h3><p class="pre">{{ s.feedback.strengths }}</p></div>
                    <div><h3>Areas to improve</h3><p class="pre">{{ s.feedback.improvements }}</p></div>
                  </div>
                  @if (s.feedback.summary) {
                    <h3>Summary</h3><p class="pre">{{ s.feedback.summary }}</p>
                  }
                  <button mat-stroked-button (click)="editing.set(true)"><mat-icon>edit</mat-icon>Edit feedback</button>
                </div>
              } @else {
                @if (!s.feedback) {
                  <p class="hint"><mat-icon>pending_actions</mat-icon>This session is completed — record feedback while it's fresh.</p>
                }
                <app-feedback-form [initial]="s.feedback" [busy]="saving()" (saved)="saveFeedback($event)" />
              }
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    .page > .card, .top { margin-bottom: 16px; }
    h2 { font-size: 1.05rem; margin: 0 0 12px; }
    h3 { font-size: 0.95rem; margin: 12px 0 4px; }
    .subtitle { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .back { display: inline-flex; align-items: center; gap: 4px; color: var(--app-muted); text-decoration: none; font-size: 0.9rem; }
    .back mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .person { display: flex; flex-direction: column; text-decoration: none; color: inherit; }
    .pre { white-space: pre-wrap; margin: 0; }
    .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .score { display: flex; flex-direction: column; padding: 10px 12px; border-radius: 10px; background: var(--app-bg); }
    .score span { font-size: 0.8rem; color: var(--app-muted); }
    .score strong { font-size: 1.25rem; }
    .score.big { background: var(--mat-sys-primary-container); }
    .hint { display: flex; align-items: center; gap: 8px; color: var(--app-warn); margin-top: 0; }
  `,
})
export class SessionDetailComponent {
  readonly id = input.required<string>();
  private readonly api = inject(SessionsApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly typeLabels = TYPE_LABELS;
  protected readonly recommendationLabels = RECOMMENDATION_LABELS;
  protected readonly skills = SKILLS;
  protected readonly session = signal<SessionDetail | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  protected readonly statusClass = computed(() => {
    const s = this.session();
    return s?.status === 'COMPLETED' && !s.feedback ? 'PENDING' : (s?.status ?? '');
  });
  protected readonly statusLabel = computed(() => {
    const s = this.session();
    if (!s) return '';
    if (s.status === 'COMPLETED' && !s.feedback) return 'Feedback pending';
    return s.status.charAt(0) + s.status.slice(1).toLowerCase();
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected complete(): void {
    this.confirm({
      title: 'Mark as completed?',
      message: 'Completed sessions can no longer be rescheduled. You can record feedback right after.',
      confirmLabel: 'Mark completed',
    })
      .pipe(switchMap(() => this.api.complete(this.id())))
      .subscribe(() => this.load(this.id()));
  }

  protected cancel(): void {
    this.confirm({
      title: 'Cancel this session?',
      message: 'Cancelled sessions stay in the history but cannot be reopened.',
      confirmLabel: 'Cancel session',
      danger: true,
    })
      .pipe(switchMap(() => this.api.cancel(this.id())))
      .subscribe(() => this.load(this.id()));
  }

  protected saveFeedback(input: FeedbackInput): void {
    this.saving.set(true);
    this.api.saveFeedback(this.id(), input).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.snackBar.open('Feedback saved', undefined, { duration: 2500 });
        this.load(this.id());
      },
      error: () => this.saving.set(false),
    });
  }

  private confirm(data: ConfirmData) {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmData, boolean>(ConfirmDialogComponent, { data })
      .afterClosed()
      .pipe(filter((ok): ok is true => ok === true));
  }

  private load(id: string): void {
    this.api.get(id).subscribe((s) => this.session.set(s));
  }
}
