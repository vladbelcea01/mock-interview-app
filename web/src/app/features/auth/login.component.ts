import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="auth-card">
      <h1>Welcome back</h1>
      <p class="lead">Sign in to plan and review mock interviews.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.hasError('email')) {
            <mat-error>Enter a valid email</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="current-password" />
        </mat-form-field>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="footer">New here? <a routerLink="/register">Create an account</a></p>
      <div class="demo">
        <strong>Demo accounts</strong><br />
        Interviewer: <code>interviewer&#64;demo.dev</code> / <code>Demo123!</code><br />
        Admin: <code>admin&#64;demo.dev</code> / <code>Admin123!</code>
      </div>
    </div>
  `,
  styleUrl: './auth-layout.scss',
  styles: `.error { color: var(--app-danger); margin: 0 0 4px; font-size: 0.9rem; }`,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly returnUrl = input<string>('/dashboard');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl() || '/dashboard'),
      error: (err: { status?: number }) => {
        this.busy.set(false);
        if (err.status === 401) this.error.set('Invalid email or password.');
      },
    });
  }
}
