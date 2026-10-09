import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

/** Like Validators.email, but ignores surrounding whitespace (it is trimmed before saving). */
export function trimmedEmail(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  return value ? Validators.email({ value } as AbstractControl) : null;
}
