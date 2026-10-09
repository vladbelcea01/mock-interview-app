import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { Participant, SESSION_TYPES, SessionInput, SessionStatus, SessionType, TYPE_LABELS } from '../../core/api.models';
import { ParticipantsApi } from '../../core/participants-api.service';
import { SessionsApi } from '../../core/sessions-api.service';
import { toLocalInput } from '../../shared/dates';

type ParticipantRef = Pick<Participant, 'id' | 'fullName'>;

@Component({
  selector: 'app-session-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="page narrow">
      <div class="page-header">
        <div>
          <a [routerLink]="id() ? ['/sessions', id()] : '/sessions'" class="back"><mat-icon>arrow_back</mat-icon>Back</a>
          <h1>{{ id() ? 'Edit session' : 'New session' }}</h1>
          @if (locked()) {
            <p class="subtitle">This session is {{ status()?.toLowerCase() }} — only notes can be changed.</p>
          }
        </div>
      </div>
      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" placeholder="e.g. System design: rate limiter" />
          @if (form.controls.title.invalid) {
            <mat-error>3–200 characters</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Participant</mat-label>
          <input
            matInput
            [formControl]="participantSearch"
            [matAutocomplete]="auto"
            placeholder="Start typing a name"
          />
          <mat-autocomplete #auto="matAutocomplete" [displayWith]="displayParticipant" (optionSelected)="pick($event.option.value)">
            @for (p of participantOptions(); track p.id) {
              <mat-option [value]="p">{{ p.fullName }} <span class="muted">· {{ p.email }}</span></mat-option>
            }
          </mat-autocomplete>
          @if (participantSearch.touched && !form.controls.participantId.value) {
            <mat-error>Pick a participant from the list</mat-error>
          }
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              @for (t of types; track t) {
                <mat-option [value]="t">{{ typeLabels[t] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Date & time</mat-label>
            <input matInput type="datetime-local" formControlName="scheduledAt" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Duration (min)</mat-label>
            <input matInput type="number" min="15" max="240" step="5" formControlName="durationMin" />
            @if (form.controls.durationMin.invalid) {
              <mat-error>15–240 minutes</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Notes / agenda</mat-label>
          <textarea matInput rows="4" formControlName="notes"></textarea>
        </mat-form-field>

        <div class="actions">
          <a mat-button [routerLink]="id() ? ['/sessions', id()] : '/sessions'">Cancel</a>
          <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Saving…' : id() ? 'Save changes' : 'Create session' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .narrow { max-width: 760px; }
    form { display: flex; flex-direction: column; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0 12px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    .back { display: inline-flex; align-items: center; gap: 4px; color: var(--app-muted); text-decoration: none; font-size: 0.9rem; }
    .back mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `,
})
export class SessionFormComponent implements OnInit {
  /** Present when editing (route param). */
  readonly id = input<string>();
  private readonly sessionsApi = inject(SessionsApi);
  private readonly participantsApi = inject(ParticipantsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly types = SESSION_TYPES;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly busy = signal(false);
  protected readonly status = signal<SessionStatus | null>(null);
  protected readonly locked = signal(false);
  protected readonly participantOptions = signal<Participant[]>([]);
  protected readonly participantSearch = new FormControl<string | ParticipantRef>('', { nonNullable: true });

  readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    participantId: ['', Validators.required],
    type: ['CODING' as SessionType, Validators.required],
    scheduledAt: [toLocalInput(this.nextHalfHour()), Validators.required],
    durationMin: [60, [Validators.required, Validators.min(15), Validators.max(240)]],
    notes: [''],
  });

  protected readonly displayParticipant = (p: ParticipantRef | string | null) =>
    typeof p === 'string' ? p : (p?.fullName ?? '');

  ngOnInit(): void {
    this.participantSearch.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          this.form.controls.participantId.setValue('');
          return this.participantsApi.list(q.trim(), 1, 8);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.participantOptions.set(res.items));
    this.participantsApi.list('', 1, 8).subscribe((res) => this.participantOptions.set(res.items));

    const id = this.id();
    if (id) {
      this.sessionsApi.get(id).subscribe((s) => {
        this.form.patchValue({ ...s, scheduledAt: toLocalInput(s.scheduledAt), notes: s.notes ?? '' });
        this.participantSearch.setValue(s.participant, { emitEvent: false });
        this.status.set(s.status);
        if (s.status !== 'SCHEDULED') {
          this.locked.set(true);
          for (const [key, control] of Object.entries(this.form.controls)) if (key !== 'notes') control.disable();
          this.participantSearch.disable();
        }
      });
    } else {
      const participantId = this.route.snapshot.queryParamMap.get('participantId');
      if (participantId) this.participantsApi.get(participantId).subscribe((p) => this.pick(p));
    }
  }

  protected pick(p: ParticipantRef): void {
    this.participantSearch.setValue(p, { emitEvent: false });
    this.form.controls.participantId.setValue(p.id);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    const raw = this.form.getRawValue();
    const id = this.id();
    const request$ = this.locked()
      ? this.sessionsApi.update(id!, { notes: raw.notes.trim() || null })
      : (() => {
          const input: SessionInput = {
            title: raw.title.trim(),
            participantId: raw.participantId,
            type: raw.type,
            scheduledAt: new Date(raw.scheduledAt).toISOString(),
            durationMin: Number(raw.durationMin),
            notes: raw.notes.trim() || null,
          };
          return id ? this.sessionsApi.update(id, input) : this.sessionsApi.create(input);
        })();
    request$.subscribe({
      next: (s) => void this.router.navigate(['/sessions', s.id]),
      error: () => this.busy.set(false),
    });
  }

  private nextHalfHour(): Date {
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return d;
  }
}
