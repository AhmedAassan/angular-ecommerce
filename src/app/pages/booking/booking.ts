// src/app/pages/booking/booking.ts
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  BookingService,
  Branch,
  Staff,
  BookingLocation,
  AppointmentCategory,
  ConfigData,
  SubmitBookingBody
} from '../../services/booking';
import { ProductService } from '../../services/product';
import { ClickOutsideDirective } from '../../directives/click-outside';
// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface BookingState {
  // Step 1
  selectedBranchId: number | null;
  selectedDate: string;
  selectedStaffId: number | null;
  
  // Step 2
  noOfPersons: number;
  serviceType: number; // 0 = salon, 1 = home
  selectedLocationId: number | null;
  notes: string;
  
  // Step 3
  otpCode: string;
  bookingId: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ClickOutsideDirective],
  templateUrl: './booking.html',
  styleUrl: './booking.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Booking implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────
  // INJECTABLES
  // ─────────────────────────────────────────────────────────────────────────
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bookingService = inject(BookingService);
  private readonly productService = inject(ProductService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  
  // Current Step (1, 2, 3)
  currentStep = signal<number>(1);
  
  // Loading States
  isLoading = signal<boolean>(true);
  isLoadingStaff = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isVerifying = signal<boolean>(false);
  staffDropdownOpen = signal<boolean>(false);
  // Config Data
  configData = signal<ConfigData | null>(null);
  branches = signal<Branch[]>([]);
  bookingLocations = signal<BookingLocation[]>([]);
  appointmentCategories = signal<AppointmentCategory[]>([]);
  staffImageBaseUrl = signal<string>('');
  currencySymbol = signal<string>('KWD');
  
  // Staff List
  staffList = signal<Staff[]>([]);
  resendTimer = signal(0);
  // Product Data (from router state or query params)
  product = signal<any>(null);
  itemUnitId = signal<number | null>(null);
  categoryId = signal<number | null>(null);
  
  // Booking Form State
  bookingState = signal<BookingState>({
    selectedBranchId: null,
    // selectedDate: this.getTodayDate(),
    selectedDate: '',
    selectedStaffId: null,
    noOfPersons: 1,
    serviceType: 0, // Default: salon
    selectedLocationId: null,
    notes: '',
    otpCode: '',
    bookingId: null
  });

  // Payment Info
  depositAmount = signal<number>(0);
  isFullPayment = signal<boolean>(true);

  // Computed
  selectedBranch = computed(() => {
    const branchId = this.bookingState().selectedBranchId;
    return this.branches().find(b => b.id === branchId) || null;
  });

  selectedStaff = computed(() => {
    const staffId = this.bookingState().selectedStaffId;
    return this.staffList().find(s => s.id === staffId) || null;
  });

  selectedLocation = computed(() => {
    const locationId = this.bookingState().selectedLocationId;
    return this.bookingLocations().find(l => l.id === locationId) || null;
  });

  canProceedStep1 = computed(() => {
    const state = this.bookingState();
    return state.selectedBranchId !== null && 
           state.selectedDate && 
           state.selectedStaffId !== null;
  });

  canProceedStep2 = computed(() => {
    const state = this.bookingState();
    const hasBasicInfo = state.noOfPersons > 0;
    const hasLocation = state.serviceType === 1 || state.selectedLocationId !== null;
    return hasBasicInfo && hasLocation;
  });

  canVerifyOtp = computed(() => {
    const state = this.bookingState();
    return state.otpCode.length >= 4 && state.bookingId !== null;
  });

  minDate = computed(() => this.getTodayDate());

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────
  
  ngOnInit(): void {
    this.loadInitialData();
    this.loadProductFromRoute();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  private loadInitialData(): void {
    this.isLoading.set(true);

    this.bookingService.getConfigData()
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (config) => {
          this.configData.set(config);
          this.branches.set(config.branches || []);
          this.bookingLocations.set(config.bookingLocations || []);
          this.appointmentCategories.set(config.apointmentCategories || []);
          this.staffImageBaseUrl.set(config.base_urls?.staff_image_url || '');
          this.currencySymbol.set(config.currency_symbol || 'KWD');

          // Check payment method setting
          const depositSetting = this.bookingService.getSettingValue(
            config.settings, 
            'onlineBookingDepositPaymentMethod'
          );
          if (depositSetting && depositSetting !== '0') {
            this.isFullPayment.set(false);
            this.depositAmount.set(Number(depositSetting) || 0);
          }

          // Auto-select first branch if only one
          if (config.branches?.length === 1) {
            this.updateBookingState({ selectedBranchId: config.branches[0].id });
            this.onBranchChange();
          }

          // Auto-select first location if only one
          if (config.bookingLocations?.length === 1) {
            this.updateBookingState({ selectedLocationId: config.bookingLocations[0].id });
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[Booking] Error loading config:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load booking configuration'
          });
        }
      });
  }
  toggleStaffDropdown(): void {
  this.staffDropdownOpen.update(v => !v);
  } 
  closeStaffDropdown(): void {
  this.staffDropdownOpen.set(false);
  }
  private loadProductFromRoute(): void {
    // Use history.state instead of getCurrentNavigation (works after navigation completes)
    const stateProduct = history.state?.product;
    
    // Always get itemUnitId from query params first
    const itemUnitIdParam = this.route.snapshot.queryParams['itemUnitId'];
    
    if (stateProduct) {
      this.product.set(stateProduct);
      this.extractProductInfo(stateProduct);
      
      // Override with query param if available
      if (itemUnitIdParam) {
        this.itemUnitId.set(Number(itemUnitIdParam));
      }
      this.cdr.markForCheck();  // Add this
      return;
    }

    // Fallback: get from query params
    const itemId = this.route.snapshot.queryParams['itemId'];

    if (itemId) {
      this.productService.getProductById(Number(itemId))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (product) => {
            if (product) {
              this.product.set(product);
              this.extractProductInfo(product);
              
              if (itemUnitIdParam) {
                this.itemUnitId.set(Number(itemUnitIdParam));
              }
              
              this.cdr.markForCheck();
            }
          },
          error: (err) => {
            console.error('[Booking] Error loading product:', err);
          }
        });
    } else if (itemUnitIdParam) {
      this.itemUnitId.set(Number(itemUnitIdParam));
    }
  }

  private extractProductInfo(product: any): void {
    // Extract itemUnitId
    const unitId = product.itemUnitId || product.units?.[0]?.itemUnitId;
    if (unitId) {
      this.itemUnitId.set(Number(unitId));
    }

    // Extract categoryId from appCategoryId
    const appCategoryId = product.appCategoryId;
    if (appCategoryId) {
      this.categoryId.set(Number(appCategoryId));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

   updateBookingState(partial: Partial<BookingState>): void {
    this.bookingState.update(state => ({ ...state, ...partial }));
  }
  

  getStaffImageUrl(staff: Staff): string {
    return this.bookingService.buildStaffImageUrl(
      this.staffImageBaseUrl(),
      staff.image
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Branch, Date, Staff Selection
  // ─────────────────────────────────────────────────────────────────────────

  selectBranch(branchId: number): void {
    this.updateBookingState({ 
      selectedBranchId: branchId,
      selectedStaffId: null // Reset staff when branch changes
    });
    this.onBranchChange();
  }

  onDateChange(): void {
    if (this.bookingState().selectedBranchId) {
      this.loadStaffAvailability();
    }
  }

  onBranchChange(): void {
    if (this.bookingState().selectedBranchId && this.bookingState().selectedDate) {
      this.loadStaffAvailability();
    }
  }

  private loadStaffAvailability(): void {
    const branchId = this.bookingState().selectedBranchId;
    const date = this.bookingState().selectedDate;

    if (!branchId || !date) return;

    this.isLoadingStaff.set(true);
    this.staffList.set([]);
    this.updateBookingState({ selectedStaffId: null });

    const bookingDate = new Date(date);

    this.bookingService.getStaffAvailability(branchId, bookingDate)
      .pipe(
        finalize(() => {
          this.isLoadingStaff.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (staff) => {
          this.staffList.set(staff);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[Booking] Error loading staff:', err);
        }
      });
  }

  selectStaff(staff: Staff): void {
  if (!staff.isAvailable) return;
  this.updateBookingState({ selectedStaffId: staff.id });
  this.closeStaffDropdown();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Service Details
  // ─────────────────────────────────────────────────────────────────────────

  selectServiceType(type: number): void {
    this.updateBookingState({ 
      serviceType: type,
      selectedLocationId: type === 1 ? null : this.bookingState().selectedLocationId
    });
  }

  selectedUnit = computed(() => {
    const prod = this.product();
    const unitId = this.itemUnitId();
    if (!prod?.units || !unitId) return null;
    return prod.units.find((u: any) => u.itemUnitId === unitId);
  });
  
  selectLocation(locationId: number): void {
    this.updateBookingState({ selectedLocationId: locationId });
  }

  incrementPersons(): void {
    this.updateBookingState({ 
      noOfPersons: this.bookingState().noOfPersons + 1 
    });
  }

  decrementPersons(): void {
    const current = this.bookingState().noOfPersons;
    if (current > 1) {
      this.updateBookingState({ noOfPersons: current - 1 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  nextStep(): void {
    const current = this.currentStep();
    if (current === 1 && this.canProceedStep1()) {
      this.currentStep.set(2);
    } else if (current === 2 && this.canProceedStep2()) {
      this.submitBooking();
    }
  }

  prevStep(): void {
    const current = this.currentStep();
    if (current > 1) {
      this.currentStep.set(current - 1);
    }
  }

  goToStep(step: number): void {
    if (step < this.currentStep()) {
      this.currentStep.set(step);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 -> 3: Submit Booking
  // ─────────────────────────────────────────────────────────────────────────

  private submitBooking(): void {
    const state = this.bookingState();
    const product = this.product();
    
    if (!state.selectedBranchId || !state.selectedStaffId) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please complete all required fields' });
      return;
    }

    this.isSubmitting.set(true);

    const body: SubmitBookingBody = {
      branchId: state.selectedBranchId,
      categoryId: this.categoryId() || 1,
      reservationDate: new Date(state.selectedDate).toISOString(),
      staffId: state.selectedStaffId,
      noOfPersons: state.noOfPersons,
      serviceType: state.serviceType,
      services: this.itemUnitId() ? [this.itemUnitId()!] : [],
      locationId: state.serviceType === 0 ? (state.selectedLocationId || 0) : 0,
      notes: state.notes
    };

    this.bookingService.submitBooking(body)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response.status) {
            this.updateBookingState({ bookingId: response.data });
            this.currentStep.set(3);
            
            Swal.fire({
              toast: true,
              icon: 'success',
              title: response.msgEN || 'OTP sent to your WhatsApp',
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Booking Failed',
              text: response.msgEN || 'Failed to submit booking'
            });
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[Booking] Submit error:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to submit booking. Please try again.'
          });
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: OTP Verification
  // ─────────────────────────────────────────────────────────────────────────

  verifyOtp(): void {
    const state = this.bookingState();
    
    if (!state.bookingId || !state.otpCode) {
      return;
    }

    this.isVerifying.set(true);

    this.bookingService.verifyBookingOtp(state.bookingId, state.otpCode)
      .pipe(
        finalize(() => {
          this.isVerifying.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response.status) {
            Swal.fire({
              icon: 'success',
              title: 'Booking Confirmed!',
              html: `
                <p>${response.msgEN || 'Your booking has been verified successfully.'}</p>
                <p class="mt-2"><strong>Reference:</strong> ${response.data}</p>
                <p class="mt-2 text-muted">Payment link has been sent to your WhatsApp.</p>
              `,
              confirmButtonText: 'OK',
              confirmButtonColor: 'var(--booking-color)'
            }).then(() => {
              this.router.navigate(['/']);
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Verification Failed',
              text: response.msgEN || 'Invalid OTP. Please try again.'
            });
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[Booking] OTP verification error:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to verify OTP. Please try again.'
          });
        }
      });
  }
  onOtpInput(event: Event, index: number): void {
  const input = event.target as HTMLInputElement;
  const value = input.value;
  
  // Only allow numbers
  input.value = value.replace(/[^0-9]/g, '');
  
  if (input.value && index < 5) {
    // Move to next input
    const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
    nextInput?.focus();
  }
  
  // Update the OTP code
  this.updateOtpCode();
}

onOtpKeydown(event: KeyboardEvent, index: number): void {
  const input = event.target as HTMLInputElement;
  
  if (event.key === 'Backspace' && !input.value && index > 0) {
    // Move to previous input
    const prevInput = document.querySelector(`input[data-index="${index - 1}"]`) as HTMLInputElement;
    prevInput?.focus();
  }
}

onOtpPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const pastedData = event.clipboardData?.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
  
  if (pastedData) {
    const inputs = document.querySelectorAll('.otp-box') as NodeListOf<HTMLInputElement>;
    pastedData.split('').forEach((char, i) => {
      if (inputs[i]) {
        inputs[i].value = char;
      }
    });
    this.updateOtpCode();
  }
}

getOtpDigit(index: number): string {
  return this.bookingState().otpCode?.[index] || '';
}

private updateOtpCode(): void {
  const inputs = document.querySelectorAll('.otp-box') as NodeListOf<HTMLInputElement>;
  const code = Array.from(inputs).map(input => input.value).join('');
  this.updateBookingState({ otpCode: code });
}

// Start resend timer
startResendTimer(): void {
  this.resendTimer.set(60);
  const interval = setInterval(() => {
    const current = this.resendTimer();
    if (current <= 1) {
      clearInterval(interval);
      this.resendTimer.set(0);
    } else {
      this.resendTimer.set(current - 1);
    }
  }, 1000);
}

  resendOtp(): void {
    // Re-submit booking to get new OTP
    this.currentStep.set(2);
    setTimeout(() => this.submitBooking(), 100);
  }
}