import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { RECOMMENDATION_LABELS, SKILLS, Summary, TYPE_LABELS } from '../../core/api.models';
import { AuthService } from '../../core/auth.service';
import { ReportsApi } from '../../core/reports-api.service';
import { ChartComponent, SERIES_COLORS } from '../../shared/chart.component';

const weekLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DecimalPipe, MatIconModule, MatButtonModule, MatProgressBarModule, ChartComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p class="subtitle">{{ auth.isAdmin() ? 'Organisation-wide activity' : 'Your interviews' }} · last 12 weeks</p>
        </div>
        <a mat-flat-button routerLink="/sessions/new"><mat-icon>add</mat-icon>New session</a>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (summary(); as s) {
        <div class="kpis">
          <a class="card kpi" routerLink="/sessions" [queryParams]="{ status: 'COMPLETED' }">
            <mat-icon>task_alt</mat-icon>
            <span class="value">{{ s.completedThisMonth }}</span>
            <span class="label">completed this month</span>
          </a>
          <a class="card kpi" routerLink="/sessions" [queryParams]="{ status: 'SCHEDULED', order: 'asc' }">
            <mat-icon>event</mat-icon>
            <span class="value">{{ s.upcomingNext7Days }}</span>
            <span class="label">upcoming in 7 days</span>
          </a>
          <a class="card kpi" [class.attention]="s.pendingFeedback > 0" routerLink="/sessions" [queryParams]="{ status: 'COMPLETED' }">
            <mat-icon>pending_actions</mat-icon>
            <span class="value">{{ s.pendingFeedback }}</span>
            <span class="label">awaiting feedback</span>
          </a>
          <div class="card kpi">
            <mat-icon>star_half</mat-icon>
            <span class="value">{{ s.avgOverallRating === null ? '–' : (s.avgOverallRating | number: '1.1-1') }}</span>
            <span class="label">average overall rating</span>
          </div>
          <div class="card kpi">
            <mat-icon>history</mat-icon>
            <span class="value">{{ s.totals.completed }}</span>
            <span class="label">completed in total</span>
          </div>
        </div>

        @if (s.totals.completed + s.totals.scheduled === 0) {
          <div class="card empty-state">
            No interviews yet. <a routerLink="/sessions/new">Schedule the first one</a> to start tracking progress.
          </div>
        } @else {
          <div class="charts">
            <div class="card">
              <h2>Sessions per week</h2>
              <app-chart [config]="perWeekChart()!" label="Sessions per week" />
            </div>
            <div class="card">
              <h2>Average skill scores per week</h2>
              <app-chart [config]="skillsChart()!" label="Average skill scores per week" />
            </div>
            <div class="card">
              <h2>Recommendations</h2>
              <app-chart [config]="recommendationChart()!" label="Recommendation breakdown" [height]="220" />
            </div>
            <div class="card">
              <h2>Sessions by type</h2>
              <app-chart [config]="typeChart()!" label="Sessions by type" [height]="220" />
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 16px; text-decoration: none; color: inherit; }
    a.kpi:hover { border-color: var(--mat-sys-primary); }
    .kpi mat-icon { color: var(--mat-sys-primary); margin-bottom: 6px; }
    .kpi .value { font-size: 1.9rem; font-weight: 700; line-height: 1.1; }
    .kpi .label { color: var(--app-muted); font-size: 0.85rem; }
    .kpi.attention mat-icon, .kpi.attention .value { color: var(--app-warn); }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 16px; }
    h2 { font-size: 1rem; margin: 0 0 12px; }
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ReportsApi);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly loading = signal(true);

  protected readonly perWeekChart = computed<ChartConfiguration | null>(() => {
    const s = this.summary();
    if (!s) return null;
    return {
      type: 'bar',
      data: {
        labels: s.sessionsPerWeek.map((w) => weekLabel(w.week)),
        datasets: [{ label: 'Sessions', data: s.sessionsPerWeek.map((w) => w.count), backgroundColor: SERIES_COLORS[0], borderRadius: 6 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    };
  });

  protected readonly skillsChart = computed<ChartConfiguration | null>(() => {
    const s = this.summary();
    if (!s) return null;
    return {
      type: 'line',
      data: {
        labels: s.skillsPerWeek.map((w) => weekLabel(w.week)),
        datasets: SKILLS.map((skill, i) => ({
          label: skill.label,
          data: s.skillsPerWeek.map((w) => w[skill.key]),
          borderColor: SERIES_COLORS[i],
          backgroundColor: SERIES_COLORS[i],
          spanGaps: true,
          tension: 0.3,
        })),
      },
      options: { scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'bottom' } } },
    };
  });

  protected readonly recommendationChart = computed<ChartConfiguration | null>(() => {
    const s = this.summary();
    if (!s) return null;
    const order = ['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE'] as const;
    const counts = order.map((r) => s.byRecommendation.find((x) => x.recommendation === r)?.count ?? 0);
    return {
      type: 'bar',
      data: {
        labels: order.map((r) => RECOMMENDATION_LABELS[r]),
        datasets: [{ label: 'Sessions', data: counts, backgroundColor: ['#15803d', '#4ade80', '#fb923c', '#dc2626'], borderRadius: 6 }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
    };
  });

  protected readonly typeChart = computed<ChartConfiguration | null>(() => {
    const s = this.summary();
    if (!s) return null;
    return {
      type: 'bar',
      data: {
        labels: s.byType.map((t) => TYPE_LABELS[t.type]),
        datasets: [{ label: 'Sessions', data: s.byType.map((t) => t.count), backgroundColor: SERIES_COLORS[3], borderRadius: 6 }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
    };
  });

  ngOnInit(): void {
    this.api.summary().subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
