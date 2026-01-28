// src/app/services/booking.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, shareReplay, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface Branch {
  id: number;
  arabicName: string;
  englishName: string;
}

export interface Staff {
  id: number;
  arabicName: string;
  englishName: string;
  image: string | null;
  isAvailable: boolean;
}

export interface BookingLocation {
  id: number;
  arabicName: string;
  englishName: string;
}

export interface AppointmentCategory {
  id: number;
  arabicName: string;
  englishName: string;
  image: string;
}

export interface ServiceItem {
  id: number;
  arabicName: string;
  englishName: string;
  price: number;
  image: string;
}

export interface BaseUrls {
  staff_image_url: string;
  product_image_url: string;
  bookingCategory_image_url: string;
  [key: string]: string;
}

export interface ConfigSetting {
  key: string;
  value: string;
}

export interface ConfigData {
  branches: Branch[];
  bookingLocations: BookingLocation[];
  apointmentCategories: AppointmentCategory[];
  base_urls: BaseUrls;
  settings: ConfigSetting[];
  currency_symbol: string;
}

export interface SubmitBookingBody {
  branchId: number;
  categoryId: number;
  reservationDate: string;
  staffId: number;
  noOfPersons: number;
  serviceType: number; // 0 = salon, 1 = home service
  services: number[];
  locationId: number;
  notes: string;
}

export interface BookingResponse {
  status: boolean;
  data: number; // bookingId
  msgEN: string | null;
  msgAR: string | null;
}

export interface OtpVerifyResponse {
  status: boolean;
  data: string; // booking reference
  msgEN: string | null;
  msgAR: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER BOOKING INTERFACES
// ─────────────────────────────────────────────────────────────────────────

export enum BookingStatus {
  Pending = 0,
  Cancelled = 1,
  Confirmed = 2,
  Rejected = 3,
  Finished = 4,
  NeedVerification = 5
}

export enum PlaceType {
  Salon = 0,
  HomeService = 1
}

export interface CustomerBooking {
  id: number;
  subject: string;
  startDate: string;
  endDate: string;
  staffId: number;
  staffArabicName: string;
  staffEnglishName: string;
  customerGuid: string;
  notes: string;
  status: BookingStatus;
  addedDate: string;
  modifiedDate: string | null;
  branchId: number;
  branchArabicName: string;
  branchEnglishName: string;
  shiftId: number;
  categoryId: number;
  categoryArabicName: string;
  categoryEnglishName: string;
  placeType: PlaceType;
  locationId: number;
  depositAmount: number;
  invoiceHeaderId: number | null;
  paymentTypeId: number;
  nofPersons: number;
  isOnline: boolean;
  code: string;
  isFullPayment: boolean;
  paymentLink: string | null;
  isCollected: boolean;
  otpIsVerified: boolean;
}

export interface CustomerBookingsResponse {
  status: boolean;
  data: CustomerBooking[];
  msgEN: string | null;
  msgAR: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // Cache for config data
  private configCache$: Observable<ConfigData> | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // GET CONFIG DATA (Cached)
  // ─────────────────────────────────────────────────────────────────────────
  getConfigData(): Observable<ConfigData> {
    if (!this.configCache$) {
      this.configCache$ = this.http
        .get<any>(`${this.base}/api/GetConfigDataExternal`)
        .pipe(
          map(res => res?.data as ConfigData),
          shareReplay(1),
          catchError(err => {
            console.error('[BookingService] Error fetching config:', err);
            this.configCache$ = null;
            return of({
              branches: [],
              bookingLocations: [],
              apointmentCategories: [],
              base_urls: { staff_image_url: '', product_image_url: '', bookingCategory_image_url: '' },
              settings: [],
              currency_symbol: 'KWD'
            } as ConfigData);
          })
        );
    }
    return this.configCache$;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET STAFF AVAILABILITY
  // ─────────────────────────────────────────────────────────────────────────
  getStaffAvailability(branchId: number, bookingDate: Date | string): Observable<Staff[]> {
    const dateStr = typeof bookingDate === 'string' 
      ? bookingDate 
      : bookingDate.toISOString();
    
    const params = new HttpParams()
      .set('BranchId', String(branchId))
      .set('BookingDate', dateStr);

    return this.http
      .get<any>(`${this.base}/api/GetStaffAvailability`, { params })
      .pipe(
        map(res => {
          if (res?.status && Array.isArray(res?.data)) {
            return res.data as Staff[];
          }
          return [];
        }),
        catchError(err => {
          console.error('[BookingService] Error fetching staff:', err);
          return of([]);
        })
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET ITEM UNITS BY CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  getItemUnitsByCategory(branchId: number, categoryId: number): Observable<ServiceItem[]> {
    const params = new HttpParams()
      .set('BranchId', String(branchId))
      .set('CategoryId', String(categoryId));

    return this.http
      .get<any>(`${this.base}/api/GetItemUnitsByCategory`, { params })
      .pipe(
        map(res => {
          if (res?.status && Array.isArray(res?.data)) {
            return res.data as ServiceItem[];
          }
          return [];
        }),
        catchError(err => {
          console.error('[BookingService] Error fetching services:', err);
          return of([]);
        })
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT BOOKING
  // ─────────────────────────────────────────────────────────────────────────
  submitBooking(body: SubmitBookingBody): Observable<BookingResponse> {
    return this.http
      .post<BookingResponse>(`${this.base}/api/SubmitBooking`, body)
      .pipe(
        catchError(err => {
          console.error('[BookingService] Error submitting booking:', err);
          return of({
            status: false,
            data: 0,
            msgEN: err?.error?.msgEN || 'Failed to submit booking',
            msgAR: err?.error?.msgAR || 'فشل في إرسال الحجز'
          });
        })
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFY OTP
  // ─────────────────────────────────────────────────────────────────────────
  verifyBookingOtp(bookingId: number, otpNumber: string): Observable<OtpVerifyResponse> {
    const otpClean = otpNumber.trim();

    const url = `${this.base}/api/VerifyBookingOtp?BookingId=${bookingId}&otpNumber=${otpClean}`;

    return this.http
      .post<OtpVerifyResponse>(url, null)
      .pipe(
        catchError(err => {
          return of({
            status: false,
            data: '',
            msgEN: err?.error?.msgEN || 'Invalid OTP',
            msgAR: err?.error?.msgAR || 'رمز التحقق غير صحيح'
          });
        })
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET BOOKINGS BY CUSTOMER
  // ─────────────────────────────────────────────────────────────────────────
  getBookingsByCustomer(): Observable<CustomerBooking[]> {
    return this.http
      .get<CustomerBookingsResponse>(`${this.base}/api/GetBookingsByCustomer`)
      .pipe(
        map(res => {
          if (res?.status && Array.isArray(res?.data)) {
            return res.data;
          }
          return [];
        }),
        catchError(err => {
          console.error('[BookingService] Error fetching customer bookings:', err);
          return of([]);
        })
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET BOOKINGS BY STATUS (Filtered)
  // ─────────────────────────────────────────────────────────────────────────
  getBookingsByStatus(status: BookingStatus): Observable<CustomerBooking[]> {
    return this.getBookingsByCustomer().pipe(
      map(bookings => bookings.filter(b => b.status === status))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET UPCOMING BOOKINGS (Confirmed & Future Date)
  // ─────────────────────────────────────────────────────────────────────────
  getUpcomingBookings(): Observable<CustomerBooking[]> {
    const now = new Date();
    return this.getBookingsByCustomer().pipe(
      map(bookings => 
        bookings
          .filter(b => 
            (b.status === BookingStatus.Confirmed || b.status === BookingStatus.Pending) && 
            new Date(b.startDate) >= now &&
            b.otpIsVerified
          )
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PAST BOOKINGS
  // ─────────────────────────────────────────────────────────────────────────
  getPastBookings(): Observable<CustomerBooking[]> {
    const now = new Date();
    return this.getBookingsByCustomer().pipe(
      map(bookings => 
        bookings
          .filter(b => 
            new Date(b.startDate) < now || 
            b.status === BookingStatus.Finished
          )
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PENDING VERIFICATION BOOKINGS
  // ─────────────────────────────────────────────────────────────────────────
  getPendingVerificationBookings(): Observable<CustomerBooking[]> {
    return this.getBookingsByCustomer().pipe(
      map(bookings => 
        bookings.filter(b => !b.otpIsVerified && b.status === BookingStatus.NeedVerification)
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET CANCELLED/REJECTED BOOKINGS
  // ─────────────────────────────────────────────────────────────────────────
  getCancelledBookings(): Observable<CustomerBooking[]> {
    return this.getBookingsByCustomer().pipe(
      map(bookings => 
        bookings.filter(b => 
          b.status === BookingStatus.Cancelled || 
          b.status === BookingStatus.Rejected
        )
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET BOOKING BY ID
  // ─────────────────────────────────────────────────────────────────────────
  getBookingById(bookingId: number): Observable<CustomerBooking | null> {
    return this.getBookingsByCustomer().pipe(
      map(bookings => bookings.find(b => b.id === bookingId) || null)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET BOOKING BY CODE
  // ─────────────────────────────────────────────────────────────────────────
  getBookingByCode(code: string): Observable<CustomerBooking | null> {
    return this.getBookingsByCustomer().pipe(
      map(bookings => bookings.find(b => b.code === code) || null)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Get Setting Value
  // ─────────────────────────────────────────────────────────────────────────
  getSettingValue(settings: ConfigSetting[], key: string): string | null {
    const setting = settings.find(s => s.key === key);
    return setting?.value ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Build Staff Image URL
  // ─────────────────────────────────────────────────────────────────────────
  buildStaffImageUrl(baseUrl: string, imageName: string | null): string {
    if (!imageName) {
      return 'assets/images/staff-placeholder.jpg';
    }
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${base}${imageName}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Get Status Label
  // ─────────────────────────────────────────────────────────────────────────
  getStatusLabel(status: BookingStatus, lang: 'en' | 'ar' = 'en'): string {
    const labels = {
      [BookingStatus.Pending]: { en: 'Pending', ar: 'قيد الانتظار' },
      [BookingStatus.Cancelled]: { en: 'Cancelled', ar: 'ملغي' },
      [BookingStatus.Confirmed]: { en: 'Confirmed', ar: 'مؤكد' },
      [BookingStatus.Rejected]: { en: 'Rejected', ar: 'مرفوض' },
      [BookingStatus.Finished]: { en: 'Finished', ar: 'مكتمل' },
      [BookingStatus.NeedVerification]: { en: 'Need Verification', ar: 'بحاجة للتحقق' }
    };
    return labels[status]?.[lang] || 'Unknown';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Get Status Color Class
  // ─────────────────────────────────────────────────────────────────────────
  getStatusColorClass(status: BookingStatus): string {
    const colors = {
      [BookingStatus.Pending]: 'text-yellow-600 bg-yellow-100',
      [BookingStatus.Cancelled]: 'text-red-600 bg-red-100',
      [BookingStatus.Confirmed]: 'text-green-600 bg-green-100',
      [BookingStatus.Rejected]: 'text-red-700 bg-red-100',
      [BookingStatus.Finished]: 'text-blue-600 bg-blue-100',
      [BookingStatus.NeedVerification]: 'text-orange-600 bg-orange-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Get Status Icon
  // ─────────────────────────────────────────────────────────────────────────
  getStatusIcon(status: BookingStatus): string {
    const icons = {
      [BookingStatus.Pending]: 'schedule',
      [BookingStatus.Cancelled]: 'cancel',
      [BookingStatus.Confirmed]: 'check_circle',
      [BookingStatus.Rejected]: 'block',
      [BookingStatus.Finished]: 'task_alt',
      [BookingStatus.NeedVerification]: 'verified_user'
    };
    return icons[status] || 'help';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Get Place Type Label
  // ─────────────────────────────────────────────────────────────────────────
  getPlaceTypeLabel(placeType: PlaceType, lang: 'en' | 'ar' = 'en'): string {
    const labels = {
      [PlaceType.Salon]: { en: 'At Salon', ar: 'في الصالون' },
      [PlaceType.HomeService]: { en: 'Home Service', ar: 'خدمة منزلية' }
    };
    return labels[placeType]?.[lang] || 'Unknown';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Format Booking Date
  // ─────────────────────────────────────────────────────────────────────────
  formatBookingDate(dateString: string, locale: string = 'en-US'): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Format Booking Time
  // ─────────────────────────────────────────────────────────────────────────
  formatBookingTime(dateString: string, locale: string = 'en-US'): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Check if booking can be cancelled
  // ─────────────────────────────────────────────────────────────────────────
  canCancelBooking(booking: CustomerBooking): boolean {
    const cancellableStatuses = [
      BookingStatus.Pending,
      BookingStatus.Confirmed,
      BookingStatus.NeedVerification
    ];
    const isFutureBooking = new Date(booking.startDate) > new Date();
    return cancellableStatuses.includes(booking.status) && isFutureBooking;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Check if booking needs OTP verification
  // ─────────────────────────────────────────────────────────────────────────
  needsOtpVerification(booking: CustomerBooking): boolean {
    return booking.status === BookingStatus.NeedVerification && !booking.otpIsVerified;
  }
}