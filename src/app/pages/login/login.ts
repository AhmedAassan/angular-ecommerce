// src/app/pages/login/login.ts
import { 
  ChangeDetectionStrategy, 
  Component, 
  inject, 
  signal, 
  computed, 
  OnInit, 
  OnDestroy,
  PLATFORM_ID 
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService, LoginDto } from '../../services/auth';
import { CartManagerService } from '../../services/cart-manager';
import { GuestCartService } from '../../services/guest-cart';
import { NgxMaterialIntlTelInputComponent } from 'ngx-material-intl-tel-input';
import { FormControl } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgxMaterialIntlTelInputComponent ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cartManager = inject(CartManagerService);
  private readonly guestCart = inject(GuestCartService);
  private readonly platformId = inject(PLATFORM_ID);

  private formSub!: Subscription;

  // ===== Return URL =====
  returnUrl: string = '/';

  // ===== Signals for Reactive State =====
  private readonly loadingSignal = signal(false);
  private readonly errorMsgSignal = signal('');
  private readonly showPasswordSignal = signal(false);

  readonly loading = computed(() => this.loadingSignal());
  readonly errorMsg = computed(() => this.errorMsgSignal());
  readonly showPassword = computed(() => this.showPasswordSignal());

  // ===== Guest Cart Info (using Signals) =====
  readonly hasGuestCart = computed(() => !this.guestCart.isEmpty());
  readonly guestCartCount = computed(() => this.guestCart.cartCount());

  // ===== Form =====
  readonly form = this.fb.nonNullable.group({
    mobile: ['', [Validators.required]],   // ✅ نفس فكرة register
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  ngOnInit(): void {
    // Get return URL from query params or sessionStorage
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] 
                  || (isPlatformBrowser(this.platformId) 
                      ? sessionStorage.getItem('checkout_redirect') 
                      : null)
                  || '/';

    // Clear any stale session on login page (silent)
    if (isPlatformBrowser(this.platformId) && this.auth.isAuthenticated()) {
      this.auth.logout(true);
    }

    // Clear error on form changes
    this.formSub = this.form.valueChanges
      .pipe(debounceTime(200))
      .subscribe(() => this.clearError());
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  // ===== Theme Helpers =====
  private getThemeColors() {
    if (!isPlatformBrowser(this.platformId)) {
      return {
        primary: '#f46d29',
        primaryHover: '#e55a1f',
        background: '#ffffff',
        text: '#1a1a1a',
      };
    }
    const root = getComputedStyle(document.documentElement);
    return {
      primary: root.getPropertyValue('--product-color').trim() || '#f46d29',
      primaryHover: root.getPropertyValue('--product-color-hover').trim() || '#e55a1f',
      background: root.getPropertyValue('--card-bg').trim() || '#ffffff',
      text: root.getPropertyValue('--text-color').trim() || '#1a1a1a',
    };
  }

  // ===== Redirect Label for Display =====
  getRedirectLabel(): string {
    if (!this.returnUrl || this.returnUrl === '/') return '';
    
    const labelMap: Record<string, string> = {
      '/checkout': 'Checkout',
      '/cart': 'Cart',
      '/profile': 'Profile',
      '/orders': 'Orders',
      '/wishlist': 'Wishlist',
    };

    // Check exact matches
    if (labelMap[this.returnUrl]) {
      return labelMap[this.returnUrl];
    }

    // Check partial matches
    for (const [path, label] of Object.entries(labelMap)) {
      if (this.returnUrl.startsWith(path)) {
        return label;
      }
    }

    // Return cleaned path
    return this.returnUrl.replace(/^\//, '').split('/')[0] || 'previous page';
  }
  get mobileCtrl(): FormControl {
    return this.form.get('mobile') as FormControl;
  }

  private fullMobile(): string {
    const v: any = this.form.get('mobile')?.value;

    const raw =
      typeof v === 'string'
        ? v
        : (v?.e164Number ?? v?.internationalNumber ?? v?.number ?? '');

    // يشيل + ومسافات وأي حاجة غير أرقام
    return String(raw).replace(/\D/g, '');
  }
  // ===== Password Visibility =====
  togglePasswordVisibility(): void {
    this.showPasswordSignal.update(show => !show);
  }

  getPasswordInputType(): string {
    return this.showPassword() ? 'text' : 'password';
  }

  // ===== Error Handling =====
  clearError(): void {
    this.errorMsgSignal.set('');
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (!field?.errors || !field?.touched) return '';
    const label = fieldName === 'mobile' ? 'Mobile' : fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    if (field.errors['required']) {
    return `${label} is required`;
    }
    if (field.errors['minlength']) {
    const requiredLength = field.errors['minlength'].requiredLength;
    return `${label} must be at least ${requiredLength} characters`;
    }
    if (field.errors['email']) {
    return 'Please enter a valid email address';
    }
    if (field.errors['pattern']) {
    return 'Please enter a valid mobile number';
    }
    return 'Invalid input';
  }

  // ===== Form Control =====
  private disableFormControls(): void {
    this.form.disable({ emitEvent: false });
  }

  private enableFormControls(): void {
    this.form.enable({ emitEvent: false });
  }

  // ===== Submit =====
  submit(): void {
    if (this.loadingSignal()) return;
    this.clearError();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const colors = this.getThemeColors();
      void Swal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'Please fill in all required fields correctly.',
        confirmButtonColor: colors.primary,
        background: colors.background,
        color: colors.text,
      });
      return;
    }

    this.loadingSignal.set(true);
    this.disableFormControls();

    const { password } = this.form.getRawValue();
    const mobile = this.fullMobile();
    const body: LoginDto = { mobile, password };
    const colors = this.getThemeColors();
    const hasGuestItems = this.hasGuestCart();
    const guestItemCount = this.guestCartCount();

    this.auth.login(body).subscribe({
      next: () => {
        // Clear redirect from sessionStorage
        if (isPlatformBrowser(this.platformId)) {
          sessionStorage.removeItem('checkout_redirect');
        }

        // Build success message
        let successTitle = `Welcome back!`;
        let successText = '';
        
        if (hasGuestItems) {
          successText = `Syncing ${guestItemCount} item${guestItemCount > 1 ? 's' : ''} to your cart...`;
        }

        void Swal.fire({
          toast: true,
          position: 'top-end',
          timer: hasGuestItems ? 3500 : 2500,
          timerProgressBar: true,
          showConfirmButton: false,
          icon: 'success',
          title: successTitle,
          text: successText || undefined,
          background: colors.primary,
          color: '#ffffff',
          iconColor: '#ffffff',
        });

        // Cart sync happens automatically via CartManagerService
        // Navigate after a brief delay to allow sync to start
        const navigateDelay = hasGuestItems ? 1000 : 500;
        
        setTimeout(() => {
          this.router.navigateByUrl(this.returnUrl);
        }, navigateDelay);
      },
      error: (err) => {
        let errorMessage = err?.error?.message ?? 'Login failed. Please try again.';
        
        // Handle specific error codes
        switch (err.status) {
          case 401:
            errorMessage = 'Invalid mobile or password.';
            break;
          case 400:
            errorMessage = 'Request was malformed. Please check your inputs.';
            break;
          case 0:
            errorMessage = 'Network error. Please check your connection.';
            break;
          case 429:
            errorMessage = 'Too many attempts. Please try again later.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
        }

        this.errorMsgSignal.set(errorMessage);
        this.loadingSignal.set(false);
        this.enableFormControls();

        void Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: errorMessage,
          confirmButtonText: 'Try Again',
          confirmButtonColor: colors.primary,
          background: colors.background,
          color: colors.text,
        });

        // Auto-clear error after 5 seconds
        setTimeout(() => this.clearError(), 5000);
      },
    });
  }

  // ===== Form Reset =====
  resetForm(): void {
    this.form.reset({ mobile: '', password: '', rememberMe: false });
    this.clearError();
    this.showPasswordSignal.set(false);
    this.enableFormControls();
  }

  // ===== Keyboard Handler =====
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
      event.preventDefault();
      this.submit();
    }
  }

  // ===== Social Login =====
  loginWithGoogle(): void {
    const colors = this.getThemeColors();
    Swal.fire({
      icon: 'info',
      title: 'Coming Soon',
      text: 'Google login will be available soon.',
      timer: 2000,
      showConfirmButton: false,
      background: colors.background,
      color: colors.text,
    });
  }

  loginWithFacebook(): void {
    const colors = this.getThemeColors();
    Swal.fire({
      icon: 'info',
      title: 'Coming Soon',
      text: 'Facebook login will be available soon.',
      timer: 2000,
      showConfirmButton: false,
      background: colors.background,
      color: colors.text,
    });
  }
}