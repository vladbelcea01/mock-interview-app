import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TitleCasePipe } from '@angular/common';
import { trimmedEmail } from '../../shared/validators';
import { ParticipantInput, SENIORITIES, Seniority } from '../../core/api.models';

@Component({
  selector: 'app-participant-form-dialog',
  imports: [ReactiveFormsModule, TitleCasePipe, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit participant' : 'New participant' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="participant-form" (ngSubmit)="save()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Full name</mat-label>
          <input matInput formControlName="fullName" />
          @if (form.controls.fullName.hasError('required')) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
          @if (form.controls.email.hasError('email')) {
            <mat-error>Enter a valid email</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Target role</mat-label>
          <input matInput formControlName="targetRole" placeholder="e.g. Backend Engineer" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Seniority</mat-label>
          <mat-select formControlName="seniority">
            @for (s of seniorities; track s) {
              <mat-option [value]="s">{{ s | titlecase }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="3" formControlName="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button type="submit" form="participant-form" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: `.form { display: flex; flex-direction: column; min-width: min(420px, 80vw); padding-top: 8px; }`,
})
export class ParticipantFormDialogComponent {
  protected readonly data = inject<Partial<ParticipantInput> | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<ParticipantFormDialogComponent, ParticipantInput>);
  protected readonly seniorities = SENIORITIES;

  readonly form = inject(FormBuilder).nonNullable.group({
    fullName: [this.data?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: [this.data?.email ?? '', [Validators.required, trimmedEmail]],
    targetRole: [this.data?.targetRole ?? '', [Validators.required, Validators.minLength(2)]],
    seniority: [(this.data?.seniority ?? 'MID') as Seniority, Validators.required],
    notes: [this.data?.notes ?? ''],
  });

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      fullName: v.fullName.trim(),
      email: v.email.trim().toLowerCase(),
      targetRole: v.targetRole.trim(),
      seniority: v.seniority,
      notes: v.notes.trim() || null,
    });
  }
}
