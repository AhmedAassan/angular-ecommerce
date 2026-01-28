// src/app/shaed/mobile-bottom-nav/mobile-bottom-nav.ts
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  HostListener,
  computed,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  Observable,
  map,
} from 'rxjs';

import { ProductService } from '../../services/product';
import { Theme, AppTheme } from '../../core/theme';
import { AppModeService } from '../../services/app-mode';

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatRippleModule,
    ReactiveFormsModule,
  ],
  templateUrl: './mobile-bottom-nav.html',
  styleUrls: ['./mobile-bottom-nav.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBottomNav {
  private readonly productSvc = inject(ProductService);
  private readonly themeService = inject(Theme);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly appModeService = inject(AppModeService);

  // ─────────────────────────────────────────────────────────────────────────
  // APP MODE (Booking vs Ecommerce)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** True if app has appointment categories (booking mode) */
  readonly isBookingMode = this.appModeService.isBookingMode;
  
  /** True if app does NOT have appointment categories (ecommerce mode) */
  readonly isEcommerceMode = this.appModeService.isEcommerceMode;

  // ─────────────────────────────────────────────────────────────────────────
  // THEME
  // ─────────────────────────────────────────────────────────────────────────

  selectedTheme: AppTheme = 'light';
  showSearch = false;
  showThemeMenu = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('theme') as AppTheme | null;
      if (saved) {
        this.selectedTheme = saved;
        this.themeService.setTheme(saved);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOST LISTENERS
  // ─────────────────────────────────────────────────────────────────────────

  // Close theme menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.theme-switcher')) {
      this.showThemeMenu = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THEME METHODS
  // ─────────────────────────────────────────────────────────────────────────

  toggleThemeMenu(): void {
    this.showThemeMenu = !this.showThemeMenu;
  }

  closeThemeMenu(): void {
    this.showThemeMenu = false;
  }

  selectTheme(theme: AppTheme): void {
    this.selectedTheme = theme;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', theme);
    }
    this.themeService.setTheme(theme);
    this.closeThemeMenu();
  }

  onThemeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppTheme;
    this.selectTheme(value);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────────────────

  toggle(): void {
    this.showSearch = !this.showSearch;

    if (this.showSearch) {
      // Close theme menu if open
      this.showThemeMenu = false;

      requestAnimationFrame(() => {
        setTimeout(() => {
          this.searchInputRef?.nativeElement.focus();
        }, 0);
      });
    }
  }

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });

  /** Live search (min 2 chars, trims spaces, returns up to 20 items) */
  readonly results$: Observable<any[] | null> = this.searchCtrl.valueChanges.pipe(
    map(v => (v ?? '').trim()),
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(term =>
      term.length >= 2
        ? this.productSvc
            // Keep it simple: backend filters by name via body; no orderBy needed.
            .searchProducts(term, { limit: 20 })
            .pipe(
              map(res => (Array.isArray(res) ? res.slice(0, 20) : [])),
              catchError(() => of([]))
            )
        : of(null)
    )
  );

  closeAndReset(): void {
    this.searchCtrl.setValue('');
    this.showSearch = false;
    this.showThemeMenu = false;
  }

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
}