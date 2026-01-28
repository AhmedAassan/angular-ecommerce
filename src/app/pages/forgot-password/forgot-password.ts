import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from '../../services/auth';
import { ProfileService, ResetPasswordDto } from '../../services/profile';

type Step = 1 | 2 | 3; // 1: mobile, 2: otp, 3: new password

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule,RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly profileSvc = inject(ProfileService);
  private readonly router = inject(Router);

  step = signal<Step>(1);
  busy = signal(false);
  msg = signal('');
  err = signal('');

  mobileForm = this.fb.nonNullable.group({
    mobileNo: ['', [Validators.required, Validators.pattern(/^\d{7,}$/)]],
  });

  otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
  });

  newPwdForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmNewPassword: ['', Validators.required],
  });

  // 1) Request OTP
  requestOtp(): void {
    if (this.mobileForm.invalid) {
      void Swal.fire({ icon: 'warning', title: 'Invalid mobile', text: 'Please enter a valid mobile number.' });
      return;
    }
    this.resetMsgs();
    this.busy.set(true);

    const mobile = this.mobileForm.getRawValue().mobileNo;
    this.auth.requestOtpNumber(mobile).subscribe({
      next: () => {
        this.busy.set(false);
        this.msg.set('OTP has been sent via WhatsApp.');
        void Swal.fire({ icon: 'success', title: 'OTP sent', text: 'Check your WhatsApp.', timer: 1600, showConfirmButton: false });
        this.step.set(2);
      },
      error: e => {
        this.busy.set(false);
        const m = e?.error?.msgEN || e?.message || 'Failed to send OTP.';
        this.err.set(m);
        void Swal.fire({ icon: 'error', title: 'Send failed', text: m });
      }
    });
  }

  // 2) Validate OTP and store JWT so resetPasswordExternal is authorized
  validateOtp(): void {
    if (this.otpForm.invalid) {
      void Swal.fire({ icon: 'warning', title: 'Invalid OTP', text: 'Please enter a valid OTP code.' });
      return;
    }
    this.resetMsgs();
    this.busy.set(true);

    const mobile = this.mobileForm.getRawValue().mobileNo;
    const otp = this.otpForm.getRawValue().otp;

    this.auth.validateOtpForReset(mobile, otp).subscribe({
      next: res => {
        this.busy.set(false);

        if (!res?.status) {
          const m = res?.msgEN || 'Invalid OTP code.';
          this.err.set(m);
          void Swal.fire({ icon: 'error', title: 'Verification failed', text: m });
          return;
        }

        if (res.data) {
          // save the temporary JWT for the reset call
          this.auth.setAccessToken(res.data);
        }

        this.msg.set('OTP verified. You can set your new password.');
        void Swal.fire({ icon: 'success', title: 'OTP verified', timer: 1400, showConfirmButton: false });
        this.step.set(3);
      },
      error: e => {
        this.busy.set(false);
        const m = e?.error?.msgEN || e?.message || 'OTP verification failed.';
        this.err.set(m);
        void Swal.fire({ icon: 'error', title: 'Verification error', text: m });
      }
    });
  }

  // 3) Reset password using resetPasswordExternal
  doResetPassword(): void {
    if (this.newPwdForm.invalid) {
      void Swal.fire({ icon: 'warning', title: 'Invalid input', text: 'Please fill the new password fields correctly.' });
      return;
    }
    const { newPassword, confirmNewPassword } = this.newPwdForm.getRawValue();
    if (newPassword !== confirmNewPassword) {
      void Swal.fire({ icon: 'error', title: 'Mismatch', text: 'New password and confirm password do not match.' });
      return;
    }

    this.resetMsgs();
    this.busy.set(true);

    const body: ResetPasswordDto = { newPassword, confirmNewPassword };

    this.profileSvc.resetPasswordExternal(body).subscribe({
      next: res => {
        this.busy.set(false);
        if (res?.status) {
          const m = res?.msgEN || 'New password changed successfully!';
          void Swal.fire({ icon: 'success', title: 'Password reset', text: m }).then(() => {
            // Option A: send to login to use the new password
            this.router.navigate(['/login']);
          });
          this.newPwdForm.reset({ newPassword: '', confirmNewPassword: '' });
        } else {
          const m = res?.msgEN || 'Failed to reset password.';
          this.err.set(m);
          void Swal.fire({ icon: 'error', title: 'Failed', text: m });
        }
      },
      error: e => {
        this.busy.set(false);
        const m = e?.error?.msgEN || e?.message || 'Error resetting password.';
        this.err.set(m);
        void Swal.fire({ icon: 'error', title: 'Error', text: m });
      }
    });
  }

  private resetMsgs() {
    this.msg.set('');
    this.err.set('');
  }
}
