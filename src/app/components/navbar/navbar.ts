// src/app/components/navbar/navbar.ts
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  PLATFORM_ID,
  inject,
  OnInit,
  DestroyRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Observable, of, combineLatest } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  map,
  startWith,
} from 'rxjs/operators';

import { Category, ApiCategory } from '../../services/category';
import { AuthService } from '../../services/auth';
import { ProductService } from '../../services/product';
import { CartManagerService } from '../../services/cart-manager';
import { GuestCartService } from '../../services/guest-cart';
import { Theme, AppTheme } from '../../core/theme';

type UiCategory = { 
  id: number; 
  name: string; 
  slug: string; 
  image?: string | null 
};

@Component({
  standalone: true,
  selector: 'app-navbar',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar implements OnInit {
  /* ─── DI ─── */
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly productSvc = inject(ProductService);
  private readonly cartManager = inject(CartManagerService);
  private readonly guestCart = inject(GuestCartService);
  private readonly categorySvc = inject(Category);
  private readonly themeService = inject(Theme);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /* ─── Cart Badge ─── */
  // Use CartManagerService for unified cart qty (works for both guest and authenticated)
  readonly cartQty$ = this.cartManager.cartQty$;
  
  // Alternative: Combine guest cart signal with server cart for accurate count
  readonly combinedCartQty$: Observable<number> = combineLatest([
    this.auth.loggedIn$,
    this.cartManager.cartQty$.pipe(startWith(0))
  ]).pipe(
    map(([isLoggedIn, serverQty]) => {
      if (isLoggedIn) {
        return serverQty;
      }
      // For guests, use signal value
      return this.guestCart.cartQty();
    })
  );

  /* ─── Cart Syncing State ─── */
  readonly isSyncing$ = this.cartManager.syncing$;

  /* ─── Theme ─── */
  selectedTheme: AppTheme = 'light';

  onThemeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppTheme;
    this.selectedTheme = value;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', value);
    }
    this.themeService.setTheme(value);
  }

  get isBsDark(): boolean {
    return [
      'dark',
      'blue-dark',
      'green-dark',
      'velvet-rose-dark',
      'graphite-mist-dark'
    ].includes(this.selectedTheme);
  }

  /* ─── Auth ─── */
  readonly loggedIn$ = this.auth.loggedIn$;
  
  // User display name (from signal)
  get userName(): string {
    const user = this.auth.user();
    return user?.fullName || user?.email || 'User';
  }

  /* ─── Categories ─── */
  private toSlug(s: string): string {
    return (s ?? '').trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/\-+/g, '-');
  }

  readonly categories$: Observable<UiCategory[]> = this.categorySvc.getCategories().pipe(
    map((list: ApiCategory[] | null | undefined) => 
      (list ?? [])
        .filter(c => c.status === 1)
        .sort((a, b) =>
          (a.position - b.position) ||
          (a.name ?? '').localeCompare(b.name ?? '')
        )
        .map<UiCategory>(c => ({
          id: c.id,
          name: (c.name ?? '').trim(),
          slug: this.toSlug(c.name ?? ''),
          image: c.image ?? null
        }))
    ),
    catchError(() => of([]))
  );

  /* ─── Responsive ─── */
  isMobile = false;

  /* ─── Live Search ─── */
  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  searchOpen = false;

  readonly results$: Observable<any[] | null> = this.searchCtrl.valueChanges.pipe(
    map(v => (v ?? '').trim()),
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(term => {
      if (term.length < 2) return of(null);
      return this.productSvc.searchProducts(term, { limit: 10 }).pipe(
        map(res => Array.isArray(res) ? res.slice(0, 10) : []),
        catchError(() => of([]))
      );
    })
  );

  /* ─── Lifecycle ─── */
  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.updateViewportFlag();
      
      // Load saved theme
      const saved = localStorage.getItem('theme') as AppTheme | null;
      if (saved) {
        this.selectedTheme = saved;
        this.themeService.setTheme(saved);
      }

      // Initial cart load
      this.cartManager.loadCart();
    }
  }

  /* ─── Window Resize ─── */
  @HostListener('window:resize')
  updateViewportFlag(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isMobile = window.innerWidth < 992;
    this.cdr.markForCheck();
  }

  /* ─── Collapse Helper ─── */
  closeIfMobile(): void {
    if (!this.isMobile) return;
    this.clearSearch();
    
    // Close Bootstrap collapse if open
    const el = document.getElementById('navbarContent');
    if (el?.classList.contains('show')) {
      const bsCollapse = (window as any).bootstrap?.Collapse?.getInstance(el);
      bsCollapse?.hide();
    }
  }

  /* ─── Search Helpers ─── */
  clearSearch(): void {
    this.searchCtrl.setValue('');
    this.searchOpen = false;
  }

  onSearchResultClick(): void {
    this.clearSearch();
    this.closeIfMobile();
  }

  /* ─── Cart Actions ─── */
  openCart(): void {
    window.dispatchEvent(new CustomEvent('cart:open'));
  }

  /* ─── Auth Actions ─── */
  logout(): void {
    this.auth.logout(false); // Show logout message
    this.closeIfMobile();
    this.router.navigate(['/']);
  }

  /* ─── Navigation with Cart State ─── */
  goToCheckout(): void {
    if (!this.auth.isAuthenticated()) {
      // Store intended destination
      sessionStorage.setItem('checkout_redirect', '/checkout');
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/checkout']);
    }
  }

  /* ─── Guest Cart Indicator ─── */
  get hasGuestItems(): boolean {
    return !this.auth.isAuthenticated() && !this.guestCart.isEmpty();
  }

  get guestItemCount(): number {
    return this.guestCart.cartCount();
  }
}