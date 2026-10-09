import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="auth-card">
      <h1>Create your account</h1>
      <p class="lead">New accounts join as interviewers.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>Full name</mat-label>
          <input matInput formControlName="name" autocomplete="name" />
          @if (form.controls.name.hasError('minlength')) {
            <mat-error>At least 2 characters</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.hasError('email')) {
            <mat-error>Enter a valid email</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>At least 8 characters</mat-hint>
          @if (form.controls.password.hasError('minlength')) {
            <mat-error>At least 8 characters</mat-error>
          }
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
      <p class="footer">Already have an account? <a routerLink="/login">Sign in</a></p>
    </div>
  `,
  styleUrl: './auth-layout.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    const { name, email, password } = this.form.getRawValue();
    this.auth.register(name.trim(), email.trim(), password).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: () => this.busy.set(false),
    });
  }
}
