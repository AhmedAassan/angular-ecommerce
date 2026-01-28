// src/app/services/auth.service.ts
import { Injectable, Inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ==================== INTERFACES ====================

export interface LoginDto {
  mobile: string;
  password: string;
}

/** Real register payload expected by /api/registerExternalUser */
export interface RegisterExternalUserDto {
  mobileNo: string;
  email: string;
  fullName: string;
  gender: 'Male' | 'Female';
  branchId: number;
  password: string;
  confirmPassword: string;
}

export interface Branch {
  id: number;
  arabicName: string;
  englishName: string;
}

export interface UserProfile {
  id?: number;
  email?: string;
  fullName?: string;
  mobileNo?: string;
  gender?: 'Male' | 'Female';
  branchId?: number;
}

export interface LoginResponse {
  status: boolean;
  token: string;
  refreshToken: string;
  expiryTime?: string;
  message?: string;
  user?: UserProfile;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiryTime?: string;
}

export interface OtpValidationResponse {
  status: boolean;
  data?: string;
  msgEN?: string;
  msgAR?: string;
}

// ==================== SERVICE ====================

@Injectable({ providedIn: 'root' })
export class AuthService {
  /* ========= API endpoints ========= */
  private readonly base = environment.apiBase;
  private readonly loginApi = `${this.base}/api/externalLogin`;
  private readonly refreshTokenApi = `${this.base}/api/refresh-token`;
  private readonly requestOtpApi = `${this.base}/api/requestOtpNumber`;
  private readonly validateOtpApi = `${this.base}/api/ValidateOtpNumber`;
  private readonly registerApi = `${this.base}/api/registerExternalUser`;
  private readonly branchesApi = `${this.base}/api/GetBranches`;
  private readonly profileApi = `${this.base}/api/GetUserProfile`; // Optional

  /* ========= Storage Keys ========= */
  private readonly TOKEN_KEY = 'eshop_token';
  private readonly REFRESH_TOKEN_KEY = 'eshop_refresh_token';
  private readonly EXPIRY_KEY = 'eshop_expiry_time';
  private readonly LAST_ACTIVITY_KEY = 'eshop_last_activity';
  private readonly USER_KEY = 'eshop_user';

  /* ========= Platform Check ========= */
  private readonly isBrowser: boolean;

  /* ========= Reactive State (BehaviorSubject for RxJS compatibility) ========= */
  private readonly _loggedIn = new BehaviorSubject<boolean>(false);
  readonly loggedIn$: Observable<boolean> = this._loggedIn.asObservable();

  /* ========= Reactive State (Angular Signals for modern reactivity) ========= */
  private readonly _isLoggedInSignal = signal<boolean>(false);
  private readonly _userSignal = signal<UserProfile | null>(null);
  private readonly _tokenSignal = signal<string | null>(null);

  /** Signal: Is user logged in? (for use in effects, computed, templates) */
  readonly isLoggedIn = this._isLoggedInSignal.asReadonly();

  /** Signal: Current user profile */
  readonly user = this._userSignal.asReadonly();

  /** Signal: Current token */
  readonly token = this._tokenSignal.asReadonly();

  /** Computed: User display name */
  readonly displayName = computed(() => {
    const u = this._userSignal();
    return u?.fullName || u?.email || 'Guest';
  });

  /** Computed: Is guest user */
  readonly isGuest = computed(() => !this._isLoggedInSignal());

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Initialize state from storage
    this.initializeState();
  }

  /* =========================
   * INITIALIZATION
   * ========================= */

  private initializeState(): void {
    if (!this.isBrowser) return;

    const hasSession = this.hasValidSession();
    const token = localStorage.getItem(this.TOKEN_KEY);
    const user = this.loadUserFromStorage();

    // Update both BehaviorSubject and Signals
    this._loggedIn.next(hasSession);
    this._isLoggedInSignal.set(hasSession);
    this._tokenSignal.set(hasSession ? token : null);
    this._userSignal.set(hasSession ? user : null);
  }

  private loadUserFromStorage(): UserProfile | null {
    if (!this.isBrowser) return null;
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private saveUserToStorage(user: UserProfile | null): void {
    if (!this.isBrowser) return;
    if (user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  }

  /* =========================
   * TOKEN MANAGEMENT
   * ========================= */

  private storeToken(token: string, refreshToken: string, expiryTimeISO?: string, user?: UserProfile): void {
    if (!this.isBrowser) return;

    const expFromJwt = this.getExpiryFromJwt(token);
    const finalExpiryISO = expiryTimeISO ?? (expFromJwt ? new Date(expFromJwt * 1000).toISOString() : '');

    // Store in localStorage
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this.LAST_ACTIVITY_KEY, new Date().toISOString());
    if (finalExpiryISO) {
      localStorage.setItem(this.EXPIRY_KEY, finalExpiryISO);
    }

    // Extract user from JWT if not provided
    const userFromJwt = user ?? this.extractUserFromJwt(token);
    if (userFromJwt) {
      this.saveUserToStorage(userFromJwt);
    }

    // Update reactive state (both BehaviorSubject and Signals)
    this._loggedIn.next(true);
    this._isLoggedInSignal.set(true);
    this._tokenSignal.set(token);
    this._userSignal.set(userFromJwt);
  }

  private getExpiryFromJwt(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof json?.exp === 'number' ? json.exp : null;
    } catch {
      return null;
    }
  }

  private extractUserFromJwt(token: string): UserProfile | null {
    try {
      const payload = token.split('.')[1];
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      
      // Common JWT claim mappings
      return {
        id: json.sub || json.userId || json.id,
        email: json.email || json.unique_name,
        fullName: json.name || json.fullName || json.given_name,
        mobileNo: json.mobileNo || json.phone_number || json.mobile,
      };
    } catch {
      return null;
    }
  }

  private hasToken(): boolean {
    return this.isBrowser && !!localStorage.getItem(this.TOKEN_KEY);
  }

  private hasValidSession(): boolean {
    if (!this.hasToken()) return false;

    // Check if session is too old (optional additional security)
    const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const lastActivityTime = new Date(lastActivity).getTime();
      const maxInactiveTime = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (Date.now() - lastActivityTime > maxInactiveTime) {
        console.log('Session too old, clearing tokens');
        this.clearTokens();
        return false;
      }
    }

    return true;
  }

  private clearTokens(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.EXPIRY_KEY);
    localStorage.removeItem(this.LAST_ACTIVITY_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /* =========================
   * PUBLIC TOKEN ACCESSORS
   * ========================= */

  getAccessToken(): string | null {
    return this.isBrowser ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  /** Alias for getAccessToken (for interceptor compatibility) */
  getToken(): string | null {
    return this.getAccessToken();
  }

  getRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem(this.REFRESH_TOKEN_KEY) : null;
  }

  setAccessToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.LAST_ACTIVITY_KEY, new Date().toISOString());
    
    const user = this.extractUserFromJwt(token);
    if (user) this.saveUserToStorage(user);

    this._loggedIn.next(true);
    this._isLoggedInSignal.set(true);
    this._tokenSignal.set(token);
    this._userSignal.set(user);
  }

  updateLastActivity(): void {
    if (this.isBrowser && this.hasToken()) {
      localStorage.setItem(this.LAST_ACTIVITY_KEY, new Date().toISOString());
    }
  }

  /* =========================
   * OTP FLOW
   * ========================= */

  /** Step 1: Send OTP to WhatsApp. API: POST /api/requestOtpNumber?MobileNo= */
  requestOtpNumber(mobileNo: string): Observable<void> {
    const params = new HttpParams().set('MobileNo', mobileNo);
    return this.http.post<void>(this.requestOtpApi, null, { params });
  }

  /** Step 2: Validate OTP for Registration. API: POST /api/ValidateOtpNumber */
  validateOtpNumber(
    mobileNo: string,
    otpNumber: string,
    resetPassword = false
  ): Observable<boolean> {
    const params = new HttpParams()
      .set('MobileNo', mobileNo)
      .set('OtpNumber', otpNumber)
      .set('ResetPassword', String(resetPassword));
    return this.http.post<OtpValidationResponse>(this.validateOtpApi, null, { params }).pipe(
      map(res => (typeof res === 'object' && 'status' in res ? !!res.status : true))
    );
  }

  /** Validate OTP for Password Reset */
  validateOtpForReset(mobileNo: string, otpNumber: string): Observable<OtpValidationResponse> {
    const params = new HttpParams()
      .set('MobileNo', mobileNo)
      .set('OtpNumber', otpNumber)
      .set('ResetPassword', 'true');
    return this.http.post<OtpValidationResponse>(this.validateOtpApi, null, { params });
  }

  /* =========================
   * REGISTRATION
   * ========================= */

  /** Step 3: Register user. API: POST /api/registerExternalUser (JSON body) */
  registerExternalUser(body: RegisterExternalUserDto): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.registerApi, body).pipe(
      tap(res => {
        // If registration returns a token, auto-login
        if (res?.status && res?.token && res?.refreshToken) {
          this.storeToken(res.token, res.refreshToken, res.expiryTime, res.user);
        }
      })
    );
  }

  /** Populate Branch select. API: GET /api/GetBranches */
  getBranches(): Observable<Branch[]> {
    return this.http
      .get<{ status: boolean; data: Branch[]; msgEN?: string; msgAR?: string }>(this.branchesApi)
      .pipe(map(r => r?.data ?? []));
  }

  /* =========================
   * LOGIN
   * ========================= */

  login(body: LoginDto): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginApi, body).pipe(
      tap(res => {
        if (res?.status && res?.token && res?.refreshToken) {
          this.storeToken(res.token, res.refreshToken, res.expiryTime, res.user);
        } else {
          throw new Error(res?.message || 'Invalid login response');
        }
      })
    );
  }

  /* =========================
   * LOGOUT
   * ========================= */

  logout(silent: boolean = true): void {
    this.clearTokens();

    // Update reactive state
    this._loggedIn.next(false);
    this._isLoggedInSignal.set(false);
    this._tokenSignal.set(null);
    this._userSignal.set(null);

    // Optional: notify about logout
    if (!silent && this.isBrowser) {
      // You could dispatch a custom event or show a toast
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  /* =========================
   * TOKEN REFRESH
   * ========================= */

  refreshToken(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    const accessToken = localStorage.getItem(this.TOKEN_KEY);
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    
    if (!accessToken || !refreshToken) {
      console.log('No tokens available for refresh');
      return of(false);
    }

    const body = { accessToken, refreshToken };

    return this.http.post(this.refreshTokenApi, body, { responseType: 'text' }).pipe(
      map(txt => JSON.parse(txt) as RefreshTokenResponse),
      tap(res => {
        if (res?.accessToken && res?.refreshToken) {
          this.storeToken(res.accessToken, res.refreshToken, res.expiryTime);
          console.log('Token refreshed successfully');
        } else {
          throw new Error('Invalid refresh response');
        }
      }),
      map(() => true),
      catchError((err: HttpErrorResponse) => {
        console.log('Token refresh failed:', err.status, err.message);

        if (err.status === 400 || err.status === 401) {
          console.log('Refresh token expired, user needs to login again');
          this.logout(true);
        }

        return throwError(() => err);
      })
    );
  }

  /** Proactive refresh: configurable grace period */
  refreshTokenIfNeeded(graceMs: number = environment.TOKEN_REFRESH_GRACE_MS ?? 120_000): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    const expiry = localStorage.getItem(this.EXPIRY_KEY);
    if (!expiry) {
      console.log('No expiry time found');
      return of(false);
    }

    const expiryMs = Date.parse(expiry);
    if (isNaN(expiryMs)) {
      console.log('Invalid expiry time format');
      return of(false);
    }

    const now = Date.now();
    const needsRefresh = now >= (expiryMs - graceMs);

    console.log('Token refresh check:', {
      now: new Date(now).toISOString(),
      expiry: new Date(expiryMs).toISOString(),
      graceMs,
      needsRefresh,
      timeUntilExpiry: Math.round((expiryMs - now) / 1000 / 60),
    });

    return needsRefresh ? this.refreshToken() : of(false);
  }

  /* =========================
   * UTILITY METHODS
   * ========================= */

  /** Check if user is authenticated (non-reactive) */
  isAuthenticated(): boolean {
    return this.hasValidSession();
  }

  /** Get current user (non-reactive) */
  getUser(): UserProfile | null {
    return this._userSignal();
  }

  /** Update user profile in state */
  updateUserProfile(updates: Partial<UserProfile>): void {
    const current = this._userSignal();
    if (current) {
      const updated = { ...current, ...updates };
      this._userSignal.set(updated);
      this.saveUserToStorage(updated);
    }
  }

  /** Fetch user profile from server (optional - if you have this endpoint) */
  fetchUserProfile(): Observable<UserProfile | null> {
    if (!this.isAuthenticated()) {
      return of(null);
    }

    return this.http.get<{ status: boolean; data: UserProfile }>(this.profileApi).pipe(
      map(res => res?.data ?? null),
      tap(user => {
        if (user) {
          this._userSignal.set(user);
          this.saveUserToStorage(user);
        }
      }),
      catchError(() => of(null))
    );
  }
}