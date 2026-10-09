import { TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { Participant, ParticipantInput } from '../../core/api.models';
import { ParticipantsApi } from '../../core/participants-api.service';
import { ParticipantFormDialogComponent } from './participant-form-dialog.component';

@Component({
  selector: 'app-participant-list',
  imports: [
    ReactiveFormsModule,
    TitleCasePipe,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Participants</h1>
          <p class="subtitle">Everyone practising interviews, shared across interviewers.</p>
        </div>
        <button mat-flat-button (click)="create()"><mat-icon>person_add</mat-icon>New participant</button>
      </div>

      <div class="card">
        <div class="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Search by name or email</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [formControl]="search" />
          </mat-form-field>
        </div>
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <div class="table-wrap">
          <table mat-table [dataSource]="items()">
            <ng-container matColumnDef="fullName">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let p"><strong>{{ p.fullName }}</strong></td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let p">{{ p.email }}</td>
            </ng-container>
            <ng-container matColumnDef="targetRole">
              <th mat-header-cell *matHeaderCellDef>Target role</th>
              <td mat-cell *matCellDef="let p">{{ p.targetRole }}</td>
            </ng-container>
            <ng-container matColumnDef="seniority">
              <th mat-header-cell *matHeaderCellDef>Seniority</th>
              <td mat-cell *matCellDef="let p">{{ p.seniority | titlecase }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" class="clickable" (click)="open(row)"></tr>
          </table>
        </div>
        @if (!loading() && items().length === 0) {
          <div class="empty-state">No participants match your search.</div>
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
})
export class ParticipantListComponent implements OnInit {
  private readonly api = inject(ParticipantsApi);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['fullName', 'email', 'targetRole', 'seniority'];
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly items = signal<Participant[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.load();
      });
    this.load();
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  protected open(p: Participant): void {
    void this.router.navigate(['/participants', p.id]);
  }

  protected create(): void {
    this.dialog
      .open<ParticipantFormDialogComponent, null, ParticipantInput>(ParticipantFormDialogComponent, { data: null })
      .afterClosed()
      .pipe(filter((v): v is ParticipantInput => !!v))
      .subscribe((input) => this.api.create(input).subscribe((p) => this.open(p)));
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(this.search.value.trim(), this.page(), this.pageSize()).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
