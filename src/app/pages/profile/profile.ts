import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, NonNullableFormBuilder } from '@angular/forms';
import { ProfileService, ExternalProfile, ChangePasswordDto } from '../../services/profile';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

type ViewMode = 'profile' | 'change';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule,RouterModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Profile {
  private readonly profileSvc = inject(ProfileService);
  // Use NonNullableFormBuilder (preferred)
  private readonly fb: NonNullableFormBuilder = inject(FormBuilder).nonNullable;

  // view state
  readonly viewMode = signal<ViewMode>('profile');

  // data state
  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly profile = signal<ExternalProfile | null>(null);

  // change password form (requires current password)
  readonly changePwdForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmNewPassword: ['', Validators.required],
  });
  readonly changePwdMessage = signal<string>('');
  readonly changePwdError = signal<string>('');

  constructor() {
    this.fetch(); // authenticated profile load only
  }

  // ---------- SweetAlert helpers ----------
  private toastSuccess(title: string, text?: string) {
    void Swal.fire({ icon: 'success', title, text, toast: true, timer: 2000, showConfirmButton: false, position: 'top-end' });
  }
  private toastError(title: string, text?: string) {
    void Swal.fire({ icon: 'error', title, text, toast: true, timer: 2500, showConfirmButton: false, position: 'top-end' });
  }
  private toastInfo(title: string, text?: string) {
    void Swal.fire({ icon: 'info', title, text, toast: true, timer: 1800, showConfirmButton: false, position: 'top-end' });
  }
  private alertWarn(title: string, text?: string) {
    void Swal.fire({ icon: 'warning', title, text });
  }

  // ---------- Data ----------
  fetch(): void {
    this.loading.set(true);
    this.error.set('');
    this.profile.set(null);

    this.profileSvc.getExternalProfile().subscribe({
      next: p => {
        this.profile.set(p);
        this.loading.set(false);
        this.toastSuccess('Profile loaded');
      },
      error: err => {
        const msg = err?.error?.msgEN || err?.message || 'Failed to load profile';
        this.error.set(msg);
        this.loading.set(false);
        this.toastError('Load failed', msg);
      }
    });
  }

  // ---------- View toggles ----------
  showProfile(): void {
    this.viewMode.set('profile');
  }

  showChange(): void {
    this.viewMode.set('change');
    this.changePwdMessage.set('');
    this.changePwdError.set('');
    this.changePwdForm.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    this.toastInfo('Change Password', 'Enter your current and new password.');
  }

  // ---------- Change password (with current password) ----------
  changePassword(): void {
    if (this.changePwdForm.invalid) {
      this.alertWarn('Invalid input', 'Please fill all fields correctly.');
      return;
    }

    const body: ChangePasswordDto = this.changePwdForm.getRawValue();
    if (body.newPassword !== body.confirmNewPassword) {
      this.toastError('Mismatch', 'New password and confirm password do not match.');
      return;
    }

    this.changePwdError.set('');
    this.changePwdMessage.set('');

    this.profileSvc.changePassword(body).subscribe({
      next: res => {
        if (res.status) {
          const msg = res.msgEN || 'Password changed successfully!';
          this.changePwdMessage.set(msg);
          Swal.fire('Success', msg, 'success').then(() => {
            this.showProfile(); // back to profile view
          });
          this.changePwdForm.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
        } else {
          const msg = res.msgEN || 'Failed to change password.';
          this.changePwdError.set(msg);
          this.toastError('Failed', msg);
        }
      },
      error: err => {
        const msg = err?.error?.msgEN || err?.message || 'Error changing password.';
        this.changePwdError.set(msg);
        this.toastError('Error', msg);
      }
    });
  }
}
