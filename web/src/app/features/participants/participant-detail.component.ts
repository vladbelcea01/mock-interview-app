import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { filter } from 'rxjs';
import {
  Participant,
  ParticipantInput,
  SessionListItem,
  SKILLS,
  Trends,
  TYPE_LABELS,
} from '../../core/api.models';
import { ParticipantsApi } from '../../core/participants-api.service';
import { ChartComponent, SERIES_COLORS } from '../../shared/chart.component';
import { ParticipantFormDialogComponent } from './participant-form-dialog.component';

@Component({
  selector: 'app-participant-detail',
  imports: [RouterLink, DatePipe, TitleCasePipe, MatButtonModule, MatIconModule, ChartComponent],
  template: `
    <div class="page">
      @if (participant(); as p) {
        <div class="page-header">
          <div>
            <a routerLink="/participants" class="back"><mat-icon>arrow_back</mat-icon>Participants</a>
            <h1>{{ p.fullName }}</h1>
            <p class="subtitle">{{ p.targetRole }} · {{ p.seniority | titlecase }} · {{ p.email }}</p>
          </div>
          <div class="actions">
            <button mat-stroked-button (click)="edit(p)"><mat-icon>edit</mat-icon>Edit</button>
            <a mat-flat-button routerLink="/sessions/new" [queryParams]="{ participantId: p.id }">
              <mat-icon>event</mat-icon>Schedule session
            </a>
          </div>
        </div>

        <div class="stats">
          <div class="card stat"><span class="value">{{ sessions().length }}</span><span class="muted">sessions</span></div>
          <div class="card stat"><span class="value">{{ completedCount() }}</span><span class="muted">completed</span></div>
          <div class="card stat">
            <span class="value">{{ latestRating() ?? '–' }}</span><span class="muted">latest overall rating</span>
          </div>
          <div class="card stat">
            <span class="value" [class.up]="ratingDelta() > 0">{{ ratingDeltaLabel() }}</span>
            <span class="muted">change since first session</span>
          </div>
        </div>

        <div class="card">
          <h2>Progress</h2>
          @if (chart(); as config) {
            <app-chart [config]="config" [height]="280" label="Skill scores per completed session" />
          } @else {
            <div class="empty-state">No completed sessions with feedback yet.</div>
          }
        </div>

        <div class="card">
          <h2>Interview history</h2>
          @if (sessions().length === 0) {
            <div class="empty-state">No sessions yet.</div>
          }
          <ol class="timeline">
            @for (s of sessions(); track s.id) {
              <li>
                <a [routerLink]="['/sessions', s.id]">
                  <span class="date">{{ s.scheduledAt | date: 'd MMM y, HH:mm' }}</span>
                  <span class="title">{{ s.title }}</span>
                  <span class="muted">{{ typeLabels[s.type] }} · {{ s.interviewer.name }}</span>
                </a>
                <span class="status-chip" [class]="s.status === 'COMPLETED' && !s.hasFeedback ? 'PENDING' : s.status">
                  {{ s.status === 'COMPLETED' && !s.hasFeedback ? 'Feedback pending' : (s.status | titlecase) }}
                </span>
              </li>
            }
          </ol>
        </div>

        @if (p.notes) {
          <div class="card"><h2>Notes</h2><p class="notes">{{ p.notes }}</p></div>
        }
      }
    </div>
  `,
  styles: `
    .page > .card { margin-bottom: 16px; }
    h2 { font-size: 1.05rem; margin: 0 0 12px; }
    .back { display: inline-flex; align-items: center; gap: 4px; color: var(--app-muted); text-decoration: none; font-size: 0.9rem; }
    .back mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
    .stat .value { font-size: 1.6rem; font-weight: 700; }
    .stat .value.up { color: var(--app-success); }
    .timeline { list-style: none; margin: 0; padding: 0; }
    .timeline li { display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 12px 0; border-bottom: 1px solid var(--app-border); }
    .timeline li:last-child { border-bottom: 0; }
    .timeline a { display: flex; flex-direction: column; text-decoration: none; color: inherit; gap: 2px; }
    .timeline .date { font-size: 0.8rem; color: var(--app-muted); }
    .timeline .title { font-weight: 600; }
    .notes { white-space: pre-wrap; margin: 0; }
  `,
})
export class ParticipantDetailComponent {
  readonly id = input.required<string>();
  private readonly api = inject(ParticipantsApi);
  private readonly dialog = inject(MatDialog);

  protected readonly typeLabels = TYPE_LABELS;
  protected readonly participant = signal<Participant | null>(null);
  protected readonly sessions = signal<SessionListItem[]>([]);
  protected readonly trends = signal<Trends | null>(null);

  protected readonly completedCount = computed(() => this.sessions().filter((s) => s.status === 'COMPLETED').length);
  protected readonly latestRating = computed(() => this.trends()?.points.at(-1)?.overallRating ?? null);
  protected readonly ratingDelta = computed(() => {
    const points = this.trends()?.points ?? [];
    return points.length < 2 ? 0 : points[points.length - 1].overallRating - points[0].overallRating;
  });
  protected readonly ratingDeltaLabel = computed(() => {
    const points = this.trends()?.points ?? [];
    if (points.length < 2) return '–';
    const d = this.ratingDelta();
    return d > 0 ? `+${d}` : `${d}`;
  });

  protected readonly chart = computed<ChartConfiguration | null>(() => {
    const points = this.trends()?.points ?? [];
    if (!points.length) return null;
    const labels = points.map((p) => new Date(p.scheduledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Overall',
            data: points.map((p) => p.overallRating),
            borderColor: '#111827',
            backgroundColor: '#111827',
            borderWidth: 3,
            tension: 0.3,
          },
          ...SKILLS.map((skill, i) => ({
            label: skill.label,
            data: points.map((p) => p[skill.key]),
            borderColor: SERIES_COLORS[i],
            backgroundColor: SERIES_COLORS[i],
            borderDash: [4, 3],
            tension: 0.3,
          })),
        ],
      },
      options: {
        scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { title: (items) => points[items[0].dataIndex].title } },
        },
      },
    };
  });

  constructor() {
    // Reload when the route param changes (the component is reused between participants).
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected edit(p: Participant): void {
    this.dialog
      .open<ParticipantFormDialogComponent, ParticipantInput, ParticipantInput>(ParticipantFormDialogComponent, { data: p })
      .afterClosed()
      .pipe(filter((v): v is ParticipantInput => !!v))
      .subscribe((input) => this.api.update(p.id, input).subscribe((updated) => this.participant.set(updated)));
  }

  private load(id: string): void {
    this.api.get(id).subscribe((p) => this.participant.set(p));
    this.api.sessions(id).subscribe((s) => this.sessions.set(s));
    this.api.trends(id).subscribe((t) => this.trends.set(t));
  }
}
