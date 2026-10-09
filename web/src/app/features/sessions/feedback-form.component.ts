import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { FeedbackInput, Recommendation, RECOMMENDATION_LABELS, RECOMMENDATIONS, SKILLS } from '../../core/api.models';

const score = (v = 3): [number, ValidatorFn[]] => [v, [Validators.required, Validators.min(1), Validators.max(5)]];

@Component({
  selector: 'app-feedback-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSliderModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div class="scores">
        @for (s of scoreFields; track s.key) {
          <label class="score">
            <span class="label">{{ s.label }}</span>
            <mat-slider min="1" max="5" step="1" discrete showTickMarks>
              <input matSliderThumb [formControlName]="s.key" [attr.aria-label]="s.label" />
            </mat-slider>
            <span class="value">{{ form.get(s.key)?.value }}/5</span>
          </label>
        }
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Recommendation</mat-label>
        <mat-select formControlName="recommendation">
          @for (r of recommendations; track r) {
            <mat-option [value]="r">{{ recommendationLabels[r] }}</mat-option>
          }
        </mat-select>
        @if (form.controls.recommendation.hasError('required')) {
          <mat-error>Choose a recommendation</mat-error>
        }
      </mat-form-field>

      <div class="grid-2">
        <mat-form-field appearance="outline">
          <mat-label>Strengths</mat-label>
          <textarea matInput rows="4" formControlName="strengths"></textarea>
          @if (form.controls.strengths.invalid) {
            <mat-error>At least 3 characters</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Areas to improve</mat-label>
          <textarea matInput rows="4" formControlName="improvements"></textarea>
          @if (form.controls.improvements.invalid) {
            <mat-error>At least 3 characters</mat-error>
          }
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Summary (optional)</mat-label>
        <textarea matInput rows="2" formControlName="summary"></textarea>
      </mat-form-field>

      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Saving…' : initial() ? 'Update feedback' : 'Save feedback' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 4px 24px; margin-bottom: 12px; }
    .score { display: grid; grid-template-columns: 1fr auto; align-items: center; }
    .score .label { grid-column: 1 / -1; font-weight: 500; font-size: 0.9rem; }
    .score mat-slider { width: 100%; }
    .score .value { font-variant-numeric: tabular-nums; color: var(--app-muted); margin-left: 8px; }
    .actions { display: flex; justify-content: flex-end; }
  `,
})
export class FeedbackFormComponent {
  readonly initial = input<FeedbackInput | null>(null);
  readonly busy = input(false);
  readonly saved = output<FeedbackInput>();

  protected readonly scoreFields = [{ key: 'overallRating', label: 'Overall' }, ...SKILLS];
  protected readonly recommendations = RECOMMENDATIONS;
  protected readonly recommendationLabels = RECOMMENDATION_LABELS;

  readonly form = inject(FormBuilder).nonNullable.group({
    overallRating: score(),
    problemSolving: score(),
    communication: score(),
    technicalDepth: score(),
    codeQuality: score(),
    recommendation: ['' as Recommendation | '', Validators.required],
    strengths: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(4000)]],
    improvements: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(4000)]],
    summary: [''],
  });

  constructor() {
    effect(() => {
      const initial = this.initial();
      if (initial) this.form.patchValue({ ...initial, summary: initial.summary ?? '' });
    });
  }

  submit(): void {
    // Whitespace-only text should fail validation, so validate the trimmed values.
    const v = this.form.getRawValue();
    this.form.patchValue({ strengths: v.strengths.trim(), improvements: v.improvements.trim() });
    if (this.form.invalid) return;
    this.saved.emit({
      overallRating: Number(v.overallRating),
      problemSolving: Number(v.problemSolving),
      communication: Number(v.communication),
      technicalDepth: Number(v.technicalDepth),
      codeQuality: Number(v.codeQuality),
      recommendation: v.recommendation as Recommendation,
      strengths: v.strengths.trim(),
      improvements: v.improvements.trim(),
      summary: v.summary.trim() || null,
    });
  }
}
