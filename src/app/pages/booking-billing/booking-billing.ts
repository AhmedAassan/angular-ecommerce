// src/app/pages/booking-billing/booking-billing.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Services
import { 
  BookingService, 
  CustomerBooking, 
  BookingStatus, 
  PlaceType,
  ConfigData
} from '../../services/booking';

// SweetAlert2
import Swal from 'sweetalert2';

// ═══════════════════════════════════════════════════════════════════════════
// STATUS INFO INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface BookingStatusInfo {
  id: BookingStatus;
  labelEN: string;
  labelAR: string;
  icon: string;
  color: string;
  bgColor: string;
}

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  rejected: number;
  finished: number;
  needVerification: number;
  upcoming: number;
  totalDeposit: number;
}

@Component({
  selector: 'app-booking-billing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    // Material
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatBadgeModule,
    MatTooltipModule,
    MatExpansionModule,
    MatTabsModule,
    MatRippleModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './booking-billing.html',
  styleUrl: './booking-billing.scss'
})
export class BookingBilling implements OnInit {
  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCY INJECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly bookingService = inject(BookingService);
  private readonly snackBar = inject(MatSnackBar);

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  readonly bookings = signal<CustomerBooking[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly configData = signal<ConfigData | null>(null);
  readonly filterStatus = signal<BookingStatus | null>(null);
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly expandedBookingId = signal<number | null>(null);
  readonly showFilters = signal<boolean>(true);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  readonly statusDefinitions: BookingStatusInfo[] = [
    {
      id: BookingStatus.Pending,
      labelEN: 'Pending',
      labelAR: 'قيد الانتظار',
      icon: 'schedule',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.15)'
    },
    {
      id: BookingStatus.Cancelled,
      labelEN: 'Cancelled',
      labelAR: 'ملغي',
      icon: 'cancel',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.15)'
    },
    {
      id: BookingStatus.Confirmed,
      labelEN: 'Confirmed',
      labelAR: 'مؤكد',
      icon: 'check_circle',
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.15)'
    },
    {
      id: BookingStatus.Rejected,
      labelEN: 'Rejected',
      labelAR: 'مرفوض',
      icon: 'block',
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.15)'
    },
    {
      id: BookingStatus.Finished,
      labelEN: 'Finished',
      labelAR: 'مكتمل',
      icon: 'task_alt',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.15)'
    },
    {
      id: BookingStatus.NeedVerification,
      labelEN: 'Need Verification',
      labelAR: 'بحاجة للتحقق',
      icon: 'verified_user',
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.15)'
    }
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════

  readonly filteredBookings = computed(() => {
    const status = this.filterStatus();
    const allBookings = this.bookings();
    
    if (status === null) {
      return allBookings;
    }
    
    return allBookings.filter(b => b.status === status);
  });

  readonly sortedBookings = computed(() => {
    return [...this.filteredBookings()].sort((a, b) => {
      // Sort by date descending (newest first)
      return new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime();
    });
  });

  readonly stats = computed<BookingStats>(() => {
    const allBookings = this.bookings();
    const now = new Date();

    return {
      total: allBookings.length,
      pending: allBookings.filter(b => b.status === BookingStatus.Pending).length,
      confirmed: allBookings.filter(b => b.status === BookingStatus.Confirmed).length,
      cancelled: allBookings.filter(b => b.status === BookingStatus.Cancelled).length,
      rejected: allBookings.filter(b => b.status === BookingStatus.Rejected).length,
      finished: allBookings.filter(b => b.status === BookingStatus.Finished).length,
      needVerification: allBookings.filter(b => b.status === BookingStatus.NeedVerification).length,
      upcoming: allBookings.filter(b => 
        (b.status === BookingStatus.Confirmed || b.status === BookingStatus.Pending) && 
        new Date(b.startDate) >= now
      ).length,
      totalDeposit: allBookings.reduce((sum, b) => sum + (b.depositAmount || 0), 0)
    };
  });

  readonly hasBookings = computed(() => this.bookings().length > 0);

  readonly activeFilterLabel = computed(() => {
    const status = this.filterStatus();
    if (status === null) return 'All Bookings';
    return this.getStatusInfo(status).labelEN;
  });

  readonly currencySymbol = computed(() => {
    return this.configData()?.currency_symbol || 'KWD';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadBookings();
    this.loadConfig();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  loadBookings(): void {
    this.loading.set(true);
    this.error.set(null);

    this.bookingService.getBookingsByCustomer().subscribe({
      next: (bookings) => {
        this.bookings.set(bookings);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load bookings');
        this.loading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Failed to load bookings',
          text: err?.message || 'Please try again later'
        });
      }
    });
  }

  loadConfig(): void {
    this.bookingService.getConfigData().subscribe({
      next: (config) => {
        this.configData.set(config);
      }
    });
  }

  refreshBookings(): void {
    this.loadBookings();
    this.snackBar.open('Bookings refreshed', 'Close', {
      duration: 2000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  setFilter(status: BookingStatus | null): void {
    this.filterStatus.set(status);
  }

  clearFilters(): void {
    this.filterStatus.set(null);
  }

  isFilterActive(status: BookingStatus | null): boolean {
    return this.filterStatus() === status;
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  toggleViewMode(): void {
    this.viewMode.update(mode => mode === 'grid' ? 'list' : 'grid');
  }

  expandBooking(bookingId: number): void {
    this.expandedBookingId.update(id => id === bookingId ? null : bookingId);
  }

  isExpanded(bookingId: number): boolean {
    return this.expandedBookingId() === bookingId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  getStatusInfo(statusId: BookingStatus): BookingStatusInfo {
    return this.statusDefinitions.find(s => s.id === statusId) || this.statusDefinitions[0];
  }

  getAllStatuses(): BookingStatusInfo[] {
    return this.statusDefinitions;
  }

  formatDate(dateString: string, locale: 'en' | 'ar' = 'en'): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatTime(dateString: string, locale: 'en' | 'ar' = 'en'): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(locale === 'ar' ? 'ar-KW' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateTime(dateString: string, locale: 'en' | 'ar' = 'en'): string {
    return `${this.formatDate(dateString, locale)} at ${this.formatTime(dateString, locale)}`;
  }

  formatCurrency(amount: number): string {
    return `${amount.toFixed(3)} ${this.currencySymbol()}`;
  }

  getPlaceTypeLabel(placeType: PlaceType, lang: 'en' | 'ar' = 'en'): string {
    return this.bookingService.getPlaceTypeLabel(placeType, lang);
  }

  getPlaceTypeIcon(placeType: PlaceType): string {
    return placeType === PlaceType.Salon ? 'store' : 'home';
  }

  isUpcoming(booking: CustomerBooking): boolean {
    return new Date(booking.startDate) >= new Date();
  }

  canCancel(booking: CustomerBooking): boolean {
    return this.bookingService.canCancelBooking(booking);
  }

  needsVerification(booking: CustomerBooking): boolean {
    return this.bookingService.needsOtpVerification(booking);
  }

  getVerificationStatusLabel(booking: CustomerBooking): string {
    return booking.otpIsVerified ? 'Verified' : 'Not Verified';
  }

  getVerificationStatusClass(booking: CustomerBooking): string {
    return booking.otpIsVerified ? 'verified' : 'not-verified';
  }

  getPaymentStatusLabel(booking: CustomerBooking): string {
    if (booking.isFullPayment && booking.isCollected) return 'Paid';
    if (booking.depositAmount > 0) return 'Deposit Paid';
    return 'Pending';
  }

  getPaymentStatusClass(booking: CustomerBooking): string {
    if (booking.isFullPayment && booking.isCollected) return 'fully-paid';
    if (booking.depositAmount > 0) return 'partially-paid';
    return 'unpaid';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS COUNT FOR BADGES
  // ═══════════════════════════════════════════════════════════════════════════

  getStatusCount(statusId: BookingStatus): number {
    const stats = this.stats();
    switch (statusId) {
      case BookingStatus.Pending: return stats.pending;
      case BookingStatus.Cancelled: return stats.cancelled;
      case BookingStatus.Confirmed: return stats.confirmed;
      case BookingStatus.Rejected: return stats.rejected;
      case BookingStatus.Finished: return stats.finished;
      case BookingStatus.NeedVerification: return stats.needVerification;
      default: return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK BY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  trackByBooking(index: number, booking: CustomerBooking): number {
    return booking.id;
  }

  trackByStatus(index: number, status: BookingStatusInfo): number {
    return status.id;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  copyBookingCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.snackBar.open('Booking code copied!', 'Close', {
        duration: 2000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    });
  }

  viewBookingDetails(booking: CustomerBooking): void {
    // You can implement a dialog or navigate to details page
    Swal.fire({
      title: `Booking #${booking.code}`,
      html: `
        <div style="text-align: left;">
          <p><strong>Date:</strong> ${this.formatDateTime(booking.startDate)}</p>
          <p><strong>Staff:</strong> ${booking.staffEnglishName}</p>
          <p><strong>Branch:</strong> ${booking.branchEnglishName}</p>
          <p><strong>Category:</strong> ${booking.categoryEnglishName}</p>
          <p><strong>Status:</strong> ${this.getStatusInfo(booking.status).labelEN}</p>
          <p><strong>Deposit:</strong> ${this.formatCurrency(booking.depositAmount)}</p>
          ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Close',
      confirmButtonColor: 'var(--product-color)'
    });
  }

  cancelBooking(booking: CustomerBooking): void {
    if (!this.canCancel(booking)) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Cancel',
        text: 'This booking cannot be cancelled.'
      });
      return;
    }

    Swal.fire({
      title: 'Cancel Booking?',
      text: `Are you sure you want to cancel booking #${booking.code}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Cancel it',
      cancelButtonText: 'Keep Booking'
    }).then((result) => {
      if (result.isConfirmed) {
        // TODO: Implement cancel booking API call
        Swal.fire({
          icon: 'info',
          title: 'Coming Soon',
          text: 'Cancel booking feature will be implemented soon.'
        });
      }
    });
  }
}