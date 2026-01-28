// src/app/services/app-mode.service.ts
import { Injectable, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, map, catchError, shareReplay, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type AppMode = 'booking' | 'ecommerce';

export interface AppModeConfig {
  mode: AppMode;
  hasAppointmentCategories: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppModeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBase;
  
  // ─────────────────────────────────────────────────────────────────────────
  // SIGNALS (works great with zoneless)
  // ─────────────────────────────────────────────────────────────────────────
  
  private readonly _mode = signal<AppMode>('ecommerce');
  private readonly _initialized = signal(false);
  
  readonly mode = this._mode.asReadonly();
  readonly initialized = this._initialized.asReadonly();
  
  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly isBookingMode = computed(() => this._mode() === 'booking');
  readonly isEcommerceMode = computed(() => this._mode() === 'ecommerce');
  
  private configCache$: Observable<AppModeConfig> | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the app mode - call this in APP_INITIALIZER
   */
  initialize(): Observable<AppModeConfig> {
    if (this.configCache$) {
      return this.configCache$;
    }

    this.configCache$ = this.http
      .get<any>(`${this.baseUrl}/api/GetConfigDataExternal`)
      .pipe(
        map(res => {
          const categories = res?.data?.apointmentCategories || [];
          const hasCategories = Array.isArray(categories) && categories.length > 0;
          
          return {
            mode: hasCategories ? 'booking' : 'ecommerce',
            hasAppointmentCategories: hasCategories
          } as AppModeConfig;
        }),
        tap(config => {
          this._mode.set(config.mode);
          this._initialized.set(true);
          
          // Store in localStorage for quick access on reload
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('app_mode', config.mode);
          }
          
          console.log(`[AppMode] Initialized: ${config.mode}`);
        }),
        catchError(err => {
          console.error('[AppMode] Failed to fetch config, defaulting to ecommerce', err);
          this._mode.set('ecommerce');
          this._initialized.set(true);
          
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('app_mode', 'ecommerce');
          }
          
          return of({ mode: 'ecommerce', hasAppointmentCategories: false } as AppModeConfig);
        }),
        shareReplay(1)
      );

    return this.configCache$;
  }

  /**
   * Initialize as Promise (for APP_INITIALIZER)
   */
  initializeAsync(): Promise<AppModeConfig> {
    return firstValueFrom(this.initialize());
  }

  /**
   * Get current mode synchronously
   */
  getCurrentMode(): AppMode {
    if (this._initialized()) {
      return this._mode();
    }
    
    // Fallback to localStorage (SSR safe check)
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('app_mode') as AppMode) || 'ecommerce';
    }
    
    return 'ecommerce';
  }

  /**
   * Clear cache and reinitialize (useful for testing)
   */
  reset(): void {
    this.configCache$ = null;
    this._initialized.set(false);
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_mode');
    }
  }
}