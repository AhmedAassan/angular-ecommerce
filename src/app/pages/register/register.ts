// import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { RouterModule, Router } from '@angular/router';
// import Swal from 'sweetalert2';
// import {
//   FormBuilder,
//   ReactiveFormsModule,
//   Validators,
//   AbstractControl,
//   ValidationErrors,
// } from '@angular/forms';
// import { AuthService } from '../../services/auth';

// type RegisterDto = { name: string; email: string; mobile: string; password: string };

// @Component({
//   standalone: true,
//   selector: 'app-register',
//   imports: [CommonModule, ReactiveFormsModule, RouterModule],
//   templateUrl: './register.html',
//   styleUrl:   './register.scss',
//   changeDetection: ChangeDetectionStrategy.OnPush,
// })
// export class Register {

//   /* DI */
//   private readonly fb     = inject(FormBuilder);
//   private readonly auth   = inject(AuthService);
//   private readonly router = inject(Router);

//   /* non-nullable form */
//   readonly form = this.fb.nonNullable.group(
//     {
//       email:    ['', [Validators.required, Validators.email]],
//       name:     ['', Validators.required],
//       mobile:   ['', [Validators.required, Validators.pattern(/^\d{7,}$/)]],
//       password: ['', [Validators.required, Validators.minLength(6)]],
//       confirm:  ['', Validators.required],
//     },
//     { validators: this.passwordMatch }
//   );

//   loading  = false;
//   errorMsg = '';

//   /* custom cross-field validator */
//   private passwordMatch(group: AbstractControl): ValidationErrors | null {
//     const pw  = group.get('password')?.value;
//     const cPw = group.get('confirm')?.value;
//     return pw && cPw && pw !== cPw ? { mismatch: true } : null;
//   }

//   submit(): void {
//     if (this.form.invalid) {
//       this.form.markAllAsTouched();
//       return;
//     }

//     const { name, email, mobile, password } = this.form.getRawValue();
//   const body: RegisterDto = { name, email, mobile, password };

//   this.loading = true;
//   this.auth.register(body).subscribe({
//     next: () => {
//       this.loading = false;

//       /* success toast (optional) */
//       void Swal.fire({
//         toast: true,
//         position: 'top-end',
//         timer: 2000,
//         icon: 'success',
//         title: 'Account created! Please log in.',
//         showConfirmButton: false,
//         background: '#f46d29',
//         color: '#fff',
//       });

//       /* go to login, optionally pre-fill e-mail/username */
//       this.router.navigate(['/login'], { queryParams: { email } });
//     },
//     error: err => {
//         this.errorMsg = err?.error?.message ?? 'Registration failed';
//         this.loading  = false;
//       },
//   });
//   }
// }



// src/app/pages/auth/register.ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  FormGroup,
  NonNullableFormBuilder,
} from '@angular/forms';
import { AuthService, Branch } from '../../services/auth';
import { NgxMaterialIntlTelInputComponent } from 'ngx-material-intl-tel-input';

type Step = 1 | 2 | 3;

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgxMaterialIntlTelInputComponent],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register implements OnInit {
  /* Services */
  private readonly fb: NonNullableFormBuilder = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /* UI state */
  step = signal<Step>(1);
  loading = signal(false);
  errorMsg = signal('');

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  passwordStrength = signal(0);

  verifiedMobile = signal(false);
  canResend = signal(true);

  branches = signal<Branch[]>([]);

  /* Forms */
  step1Form!: FormGroup;  // mobile
  step2Form!: FormGroup;  // otp
  step3Form!: FormGroup;  // full registration

  ngOnInit(): void {
    // STEP 1: mobile number
    this.step1Form = this.fb.group({
      mobileNo: ['', [Validators.required]],
    });

    // STEP 2: OTP
    this.step2Form = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    });

    // STEP 3: full registration (API exact fields)
    this.step3Form = this.fb.group(
      {
        fullName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        gender: ['Male', Validators.required], // 'Male' | 'Female'
        branchId: [0, [Validators.required, Validators.min(0)]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),                 // <- was 6
            Validators.pattern(/^(?=.*[A-Z])(?=.*\d).{8,}$/), // Uppercase & digit
            this.passwordStrengthValidator,
          ],
        ],
        confirmPassword: ['', Validators.required],
        acceptTerms: [false, Validators.requiredTrue],
      },
      { validators: this.passwordMatch }
    );

    // strength meter
    this.step3Form
      .get('password')!
      .valueChanges.subscribe(v => this.passwordStrength.set(this.calculatePasswordStrength(v ?? '')));
  }

  /* ───────── Validators ───────── */

  private passwordMatch = (group: AbstractControl): ValidationErrors | null => {
    const pw = group.get('password')?.value;
    const c = group.get('confirmPassword')?.value;
    return pw && c && pw !== c ? { mismatch: true } : null;
  };

  private passwordStrengthValidator = (control: AbstractControl): ValidationErrors | null => {
    const strength = this.calculatePasswordStrength(control.value ?? '');
    return strength < 50 ? { weakPassword: true } : null;
  };

  private calculatePasswordStrength(value: string): number {
    if (!value) return 0;
    let s = 0;
    if (value.length >= 8) s += 25;
    else if (value.length >= 6) s += 15;
    if (/[A-Z]/.test(value)) s += 25;
    if (/[a-z]/.test(value)) s += 25;
    if (/\d/.test(value)) s += 15;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) s += 10;
    return Math.min(s, 100);
  }

  /* ───────── Password UI helpers ───────── */
  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') this.showPassword.update(v => !v);
    else this.showConfirmPassword.update(v => !v);
  }
  getPasswordStrengthClass(): string {
    const v = this.passwordStrength();
    if (v < 25) return 'strength-weak';
    if (v < 50) return 'strength-fair';
    if (v < 75) return 'strength-good';
    return 'strength-strong';
  }
  getPasswordStrengthText(): string {
    const v = this.passwordStrength();
    if (v < 25) return 'Weak';
    if (v < 50) return 'Fair';
    if (v < 75) return 'Good';
    return 'Strong';
  }

  clearError(): void { this.errorMsg.set(''); }

  get mobileCtrl(): FormControl {
    return this.step1Form.get('mobileNo') as FormControl;
  }
  private fullMobileNo(): string {
    const v: any = this.step1Form.get('mobileNo')?.value;

    // ngx-material-intl-tel-input غالبًا بيرجع object
    const raw =
      typeof v === 'string'
        ? v
        : (v?.e164Number ?? v?.internationalNumber ?? v?.number ?? '');

    // يشيل + ومسافات وأي حاجة غير أرقام
    return String(raw).replace(/\D/g, '');
  }

  /* ───────── STEP 1: Send OTP ───────── */
  sendOtp(): void {
    if (this.step1Form.invalid) { this.step1Form.markAllAsTouched(); return; }

    const mobileNo = this.fullMobileNo();
    console.log('mobileNo to send:', mobileNo);
    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.requestOtpNumber(mobileNo).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set(2);
        this.startResendCooldown();
        Swal.fire({ toast: true, position: 'top-end', timer: 1800, showConfirmButton: false, icon: 'success', title: 'OTP sent via WhatsApp' });
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(this.pickErr(err, 'Failed to send OTP'));
      }
    });
  }

  resendOtp(): void {
    if (!this.canResend()) return;
    const mobileNo = this.fullMobileNo();
    this.auth.requestOtpNumber(mobileNo).subscribe({
      next: () => this.startResendCooldown(),
      error: err => this.errorMsg.set(this.pickErr(err, 'Failed to resend OTP'))
    });
  }

  private startResendCooldown(seconds = 30) {
    this.canResend.set(false);
    setTimeout(() => this.canResend.set(true), seconds * 1000);
  }

  /* ───────── STEP 2: Validate OTP ───────── */
  verifyOtp(): void {
    if (this.step2Form.invalid) { this.step2Form.markAllAsTouched(); return; }

    const mobileNo = this.fullMobileNo();
    const otpNumber: string = this.step2Form.get('otp')!.value;

    this.loading.set(true);
    this.errorMsg.set('');

    // ResetPassword must be false for registration
    this.auth.validateOtpNumber(mobileNo, otpNumber, false).subscribe({
      next: ok => {
        this.loading.set(false);
        if (!ok) { this.errorMsg.set('Invalid OTP code.'); return; }

        this.verifiedMobile.set(true);
        this.step.set(3);

        // Load branches for the select
        this.auth.getBranches().subscribe({
          next: brs => {
            this.branches.set(brs);
            if (brs.length && !this.step3Form.get('branchId')!.value) {
              this.step3Form.get('branchId')!.setValue(brs[0].id);
            }
          }
        });

        Swal.fire({ toast: true, position: 'top-end', timer: 1200, showConfirmButton: false, icon: 'success', title: 'Mobile verified' });
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(this.pickErr(err, 'OTP verification failed'));
      }
    });
  }

  /* ───────── STEP 3: Register ───────── */
  submit(): void {
    if (!this.verifiedMobile()) {
      this.errorMsg.set('Please verify your mobile number first.');
      this.step.set(1);
      return;
    }
    if (this.step3Form.invalid) {
      this.step3Form.markAllAsTouched();
      this.scrollToFirstError();
      return;
    }

    const mobileNo = this.fullMobileNo();
    const { fullName, email, gender, branchId, password, confirmPassword } = this.step3Form.getRawValue();

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.registerExternalUser({
      mobileNo, email, fullName, gender, branchId, password, confirmPassword
    }).subscribe({
      next: () => {
        this.loading.set(false);
        void Swal.fire({
          toast: true, position: 'top-end', timer: 3000, icon: 'success',
          title: 'Account created successfully!',
          showConfirmButton: false
        });
        this.router.navigate(['/login'], { queryParams: { email } });
      },
      error: err => {
        this.errorMsg.set(this.pickErr(err, 'Registration failed. Please try again.'));
        this.loading.set(false);
        this.scrollToError();
      }
    });
  }

  /* ───────── Utilities / UI helpers ───────── */

  private pickErr(err: any, fallback: string): string {
    return err?.error?.message ?? err?.message ?? fallback;
  }

  private scrollToFirstError(): void {
    const firstError = document.querySelector('.is-invalid');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  private scrollToError(): void {
    setTimeout(() => {
      const el = document.querySelector('.alert-danger');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  hasFieldError(group: 'step1' | 'step2' | 'step3', field: string): boolean {
    const fg = group === 'step1' ? this.step1Form : group === 'step2' ? this.step2Form : this.step3Form;
    const c = fg.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /* For your template’s labels/errors if needed */
  getFieldError(group: 'step1' | 'step2' | 'step3', field: string): string {
    const fg = group === 'step1' ? this.step1Form : group === 'step2' ? this.step2Form : this.step3Form;
    const c = fg.get(field);
    if (!c || !c.errors) return '';
    const e = c.errors;
    if (e['required']) return 'This field is required';
    if (e['email']) return 'Please enter a valid email address';
    if (e['minlength']) return `Must be at least ${e['minlength'].requiredLength} characters`;
    if (e['pattern'] && field === 'password') return 'Must include 1 uppercase letter and 1 number';
    if (e['weakPassword']) return 'Password is too weak';
    if (fg.errors?.['mismatch'] && (field === 'confirmPassword' || field === 'password')) return 'Passwords do not match';
    if (e['requiredTrue']) return 'You must accept the terms and conditions';
    return 'Invalid input';
  }
}