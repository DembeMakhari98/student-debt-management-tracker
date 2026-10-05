import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** The sign-in screen: exchanges credentials for a JWT, then returns to where the user was headed. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly shake = signal(false);
  readonly showPassword = signal(false);
  readonly capsLock = signal(false);

  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [true],
  });

  invalid(field: 'username' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
    this.passwordInput()?.nativeElement.focus();
  }

  onKey(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password, remember } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(username, password, remember).subscribe({
      next: () => this.router.navigateByUrl(this.safeReturnUrl()),
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(this.messageFor(err));
        this.form.controls.password.reset();
        this.shake.set(true);
      },
    });
  }

  /** Only same-app paths, so a crafted ?returnUrl= can't bounce the user off-site. */
  private safeReturnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/home';
  }

  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) return err.error?.message ?? 'Incorrect username or password';
      if (err.status === 0) return "Can't reach the server. Check that the backend is running and try again.";
    }
    return 'Something went wrong signing you in. Please try again.';
  }
}
