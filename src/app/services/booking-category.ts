// src/app/services/booking-category.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError, tap } from 'rxjs/operators';
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
  deposit: number;      
  isMakeup: boolean;
  isPackage: boolean;
}

export interface ServiceItem {
  id: number;
  arabicName: string;
  englishName: string;
  price: number;
  image: string | null;
  duration: number;
  itemType: 1 | 2;
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

export interface BusinessInfo {
  paymentTerms: string | null;
  shop_logo?: string | null;
  currency?: string | null;
  shop_nameEN?: string | null;
  shop_nameAR?: string | null;
}

export interface CategoryConfigData {
  business_info?: BusinessInfo;
  branches: Branch[];
  bookingLocations: BookingLocation[];
  apointmentCategories: AppointmentCategory[];
  base_urls: BaseUrls;
  settings: ConfigSetting[];
  currency_symbol: string;
}

export interface SubmitCategoryBookingBody {
  branchId: number;
  categoryId: number;
  reservationDate: string;
  staffId: number;
  noOfPersons: number;
  serviceType: number;
  services: number[];
  locationId: number | null;
  notes: string;
}

export interface ApiResponse<T> {
  status: boolean;
  data: T;
  msgEN: string | null;
  msgAR: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class BookingCategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBase;
  private configCache$: Observable<CategoryConfigData> | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG DATA
  // ─────────────────────────────────────────────────────────────────────────
  
  getConfigData(force = false): Observable<CategoryConfigData> {
    if (force) this.configCache$ = null;

    if (!this.configCache$) {
      this.configCache$ = this.http
        .get<ApiResponse<CategoryConfigData>>(`${this.baseUrl}/api/GetConfigDataExternal`)
        .pipe(
          map(res => res.data),
          shareReplay(1),
          catchError(() => of(this.getEmptyConfig()))
        );
    }
    return this.configCache$;
  }

  private getEmptyConfig(): CategoryConfigData {
    return {
      branches: [],
      bookingLocations: [],
      apointmentCategories: [],
      base_urls: { staff_image_url: '', product_image_url: '', bookingCategory_image_url: '' },
      settings: [],
      currency_symbol: 'KWD'
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES BY CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  
  getServicesByCategory(branchId: number, categoryId: number): Observable<ServiceItem[]> {
    const url = `${this.baseUrl}/api/GetItemUnitsByCategory?BranchId=${branchId}&CategoryId=${categoryId}`;
    return this.http.get<ApiResponse<ServiceItem[]>>(url).pipe(
      map(res => res.status ? res.data : []),
      catchError(() => of([]))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAFF AVAILABILITY
  // ─────────────────────────────────────────────────────────────────────────
  
  getStaffAvailability(branchId: number, date: string): Observable<Staff[]> {
    const bookingDate = new Date(date).toISOString();
    const params = new HttpParams()
      .set('BranchId', String(branchId))
      .set('BookingDate', bookingDate);

    return this.http.get<ApiResponse<Staff[]>>(
      `${this.baseUrl}/api/GetStaffAvailability`, 
      { params }
    ).pipe(
      map(res => res.status ? res.data : []),
      catchError(() => of([]))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT BOOKING (Returns payment URL now)
  // ─────────────────────────────────────────────────────────────────────────
  
  submitBooking(body: SubmitCategoryBookingBody): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.baseUrl}/api/SubmitBooking`, body).pipe(
      catchError(err => of({
        status: false,
        data: '',
        msgEN: err?.error?.msgEN || 'Failed to submit booking',
        msgAR: err?.error?.msgAR || 'فشل في إرسال الحجز'
      }))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ITEMS BY STAFF (Makeup flow)
  // ─────────────────────────────────────────────────────────────────────────
  
  getItemsByStaff(categoryId: number, staffId: number) {
    const url = `${this.baseUrl}/api/GetItemUnitsByStaff?CategoryId=${categoryId}&StaffId=${staffId}`;
    return this.http.get<ApiResponse<ServiceItem[]>>(url).pipe(
      tap(res => console.log('[GetItemUnitsByStaff response]', res)),
      map(res => res.status ? res.data : []),
      catchError(err => {
        console.log('[GetItemUnitsByStaff error]', err);
        return of([]);
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AVAILABLE TIME SLOTS (Makeup flow)
  // ─────────────────────────────────────────────────────────────────────────
  
  getAvailableTimeSlots(staffId: number, bookingDate: string, itemIds: number[]): Observable<string[]> {
    const bookingDateIso = new Date(bookingDate).toISOString();
    const url = `${this.baseUrl}/api/GetAvailableTimeSlots?StaffId=${staffId}&BookingDate=${bookingDateIso}`;

    return this.http.post<ApiResponse<string[]>>(url, itemIds).pipe(
      map(res => res.status ? res.data : []),
      catchError(() => of([]))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  
  getSetting(settings: ConfigSetting[], key: string): string | null {
    return settings.find(s => s.key === key)?.value ?? null;
  }

  buildImageUrl(baseUrl: string, image: string | null, placeholder = 'assets/images/placeholder.jpg'): string {
    if (!image) return placeholder;
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${base}${image}`;
  }
}