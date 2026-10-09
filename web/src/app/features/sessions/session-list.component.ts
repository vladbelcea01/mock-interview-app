import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import {
  SESSION_STATUSES,
  SESSION_TYPES,
  SessionListItem,
  SessionQuery,
  SessionStatus,
  SessionType,
  TYPE_LABELS,
} from '../../core/api.models';
import { AuthService } from '../../core/auth.service';
import { SessionsApi } from '../../core/sessions-api.service';
import { dayBoundary } from '../../shared/dates';

type SortField = NonNullable<SessionQuery['sort']>;

@Component({
  selector: 'app-session-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    TitleCasePipe,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Interview sessions</h1>
          <p class="subtitle">{{ auth.isAdmin() ? 'All interviewers' : 'Sessions you run' }} · {{ total() }} total</p>
        </div>
        <a mat-flat-button routerLink="/sessions/new"><mat-icon>add</mat-icon>New session</a>
      </div>

      <div class="card">
        <form class="filters" [formGroup]="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Title contains</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput formControlName="q" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="">Any</mat-option>
              @for (s of statuses; track s) {
                <mat-option [value]="s">{{ s | titlecase }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="">Any</mat-option>
              @for (t of types; track t) {
                <mat-option [value]="t">{{ typeLabels[t] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>From</mat-label>
            <input matInput type="date" formControlName="from" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>To</mat-label>
            <input matInput type="date" formControlName="to" />
          </mat-form-field>
          <button mat-button type="button" (click)="filters.reset()">Clear</button>
        </form>

        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <div class="table-wrap">
          <table
            mat-table
            [dataSource]="items()"
            matSort
            [matSortActive]="sort()"
            [matSortDirection]="order()"
            matSortDisableClear
            (matSortChange)="onSort($event)"
          >
            <ng-container matColumnDef="scheduledAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>When</th>
              <td mat-cell *matCellDef="let s">{{ s.scheduledAt | date: 'EEE d MMM, HH:mm' }}</td>
            </ng-container>
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Session</th>
              <td mat-cell *matCellDef="let s">
                <strong>{{ s.title }}</strong>
                <div class="muted small">{{ typeLabel(s) }} · {{ s.durationMin }} min</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="participant">
              <th mat-header-cell *matHeaderCellDef>Participant</th>
              <td mat-cell *matCellDef="let s">{{ s.participant.fullName }}</td>
            </ng-container>
            <ng-container matColumnDef="interviewer">
              <th mat-header-cell *matHeaderCellDef>Interviewer</th>
              <td mat-cell *matCellDef="let s">{{ s.interviewer.name }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let s">
                <span class="status-chip" [class]="statusClass(s)">{{ statusLabel(s) }}</span>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" class="clickable" (click)="open(row)"></tr>
          </table>
        </div>
        @if (!loading() && items().length === 0) {
          <div class="empty-state">No sessions match these filters.</div>
        }
        <mat-paginator
          [length]="total()"
          [pageIndex]="page() - 1"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPage($event)"
        />
      </div>
    </div>
  `,
  styles: `.small { font-size: 0.8rem; }`,
})
export class SessionListComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(SessionsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = SESSION_STATUSES;
  protected readonly types = SESSION_TYPES;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly columns = ['scheduledAt', 'title', 'participant', 'interviewer', 'status'];
  protected readonly filters = inject(FormBuilder).nonNullable.group({
    q: '',
    status: '' as SessionStatus | '',
    type: '' as SessionType | '',
    from: '',
    to: '',
  });

  protected readonly items = signal<SessionListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<SortField>('scheduledAt');
  protected readonly order = signal<'asc' | 'desc'>('desc');
  protected readonly loading = signal(false);

  ngOnInit(): void {
    // Filters live in the URL so a refreshed or shared link shows the same view.
    const qp = this.route.snapshot.queryParamMap;
    this.filters.patchValue(
      {
        q: qp.get('q') ?? '',
        status: (qp.get('status') ?? '') as SessionStatus | '',
        type: (qp.get('type') ?? '') as SessionType | '',
        from: qp.get('from') ?? '',
        to: qp.get('to') ?? '',
      },
      { emitEvent: false },
    );
    this.page.set(Number(qp.get('page') ?? 1) || 1);
    this.sort.set((qp.get('sort') as SortField) ?? 'scheduledAt');
    this.order.set(qp.get('order') === 'asc' ? 'asc' : 'desc');

    this.filters.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.page.set(1);
      this.reload();
    });
    this.reload();
  }

  protected onSort(e: Sort): void {
    this.sort.set(e.active as SortField);
    this.order.set(e.direction === 'asc' ? 'asc' : 'desc');
    this.reload();
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.reload();
  }

  protected open(s: SessionListItem): void {
    void this.router.navigate(['/sessions', s.id]);
  }

  protected typeLabel(s: SessionListItem): string {
    return TYPE_LABELS[s.type];
  }

  protected statusClass(s: SessionListItem): string {
    return s.status === 'COMPLETED' && !s.hasFeedback ? 'PENDING' : s.status;
  }

  protected statusLabel(s: SessionListItem): string {
    if (s.status === 'COMPLETED' && !s.hasFeedback) return 'Feedback pending';
    return s.status.charAt(0) + s.status.slice(1).toLowerCase();
  }

  private reload(): void {
    const f = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        q: f.q || null,
        status: f.status || null,
        type: f.type || null,
        from: f.from || null,
        to: f.to || null,
        page: this.page() > 1 ? this.page() : null,
        sort: this.sort() !== 'scheduledAt' ? this.sort() : null,
        order: this.order() !== 'desc' ? this.order() : null,
      },
    });
    this.loading.set(true);
    this.api
      .list({
        q: f.q.trim() || undefined,
        status: f.status,
        type: f.type,
        from: dayBoundary(f.from),
        to: dayBoundary(f.to, true),
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sort(),
        order: this.order(),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
