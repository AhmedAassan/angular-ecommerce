// src/app/pages/home/home.ts
import { 
  Component, 
  ChangeDetectionStrategy, 
  inject, 
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, finalize, distinctUntilChanged } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { ProductService, GetProductsBody } from '../../services/product';
import { CartManagerService } from '../../services/cart-manager';
import { AuthService } from '../../services/auth';
import { HeaderCarousel } from '../../components/header-carousel/header-carousel';
import { CategoryRail } from '../../components/category-rail/category-rail';
interface ProductCard {
  itemId: number;
  id?: number;
  englishName?: string;
  arabicName?: string;
  price?: number;
  salePrice?: number;
  originalPrice?: number;
  discountPercentage?: number;
  fullImageUrl?: string;
  documentName?: string;
  unitEnglishName?: string;
  unitArabicName?: string;
  itemUnitId?: number;
  defaultItemUnitId?: number;
  itemType?: number;
  units?: Array<{ itemUnitId: number; unitEnglishName?: string; unitArabicName?: string }>;
  isWished?: boolean;
  isAddingToCart?: boolean;
  isBooking?: boolean;
  justAdded?: boolean;
  justBooked?: boolean;
  isNew?: boolean;
  outOfStock?: boolean;
  rating?: number;
  reviewCount?: number;
  [key: string]: any;
}
interface FilterState {
  categoryId: number | null;
  categoryName: string | null;
  orderBy: string | undefined;
  direction: 'asc' | 'desc' | undefined;
}
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderCarousel, CategoryRail],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Home implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  readonly cartManager = inject(CartManagerService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly ITEM_TYPE_BOOKING = 2;
  // ===== Pagination Config =====
  readonly INITIAL_DISPLAY_COUNT = 30;
  readonly LOAD_MORE_COUNT = 10;
  // ===== ALL products fetched from API (cached) =====
  private allProductsCache = signal<ProductCard[]>([]);
  // ===== Reactive State =====
  private readonly displayCountSignal = signal<number>(this.INITIAL_DISPLAY_COUNT);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly loadingMoreSignal = signal<boolean>(false);
  private readonly allProductsLoadedSignal = signal<boolean>(false);
  // Visible products (computed from cache + display count)
  readonly products = computed(() => {
    const count = this.displayCountSignal();
    return this.allProductsCache().slice(0, count);
  });
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  // Total count of all products
  readonly totalCount = computed(() => this.allProductsCache().length);
  // Has more products to show
  readonly hasMore = computed(() => {
    return this.displayCountSignal() < this.allProductsCache().length;
  });
  // Is empty
  readonly isEmpty = computed(() => {
    return !this.loadingSignal() && this.allProductsCache().length === 0;
  });
  // Show load more button
  readonly showLoadMore = computed(() => {
    return !this.loadingSignal() && 
           !this.loadingMoreSignal() && 
           this.hasMore() &&
           this.allProductsCache().length > 0;
  });
  // Remaining products count
  readonly remainingCount = computed(() => {
    return Math.max(0, this.allProductsCache().length - this.displayCountSignal());
  });
  // Currently displayed count
  readonly displayedCount = computed(() => {
    return Math.min(this.displayCountSignal(), this.allProductsCache().length);
  });
  // Current filter state - use signal for reactivity
  private currentFilters = signal<FilterState>({
    categoryId: null,
    categoryName: null,
    orderBy: undefined,
    direction: undefined
  });
  readonly isLoggedIn$ = this.auth.loggedIn$;
  showCartToast = false;
  private toastTimeout: any;
  ngOnInit(): void {
    // console.log('[Home] ngOnInit - subscribing to queryParamMap');
    
    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(q => {
        const categoryIdStr = q.get('categoryId');
        const categoryName = q.get('category');
        const orderBy = q.get('orderBy') || undefined;
        const direction = (q.get('direction') as 'asc' | 'desc') || undefined;
        const categoryId = categoryIdStr ? Number(categoryIdStr) : null;
        // console.log('[Home] Query params changed:', {
        //   categoryIdStr,
        //   categoryId,
        //   categoryName,
        //   orderBy,
        //   direction
        // });
        const newFilters: FilterState = {
          categoryId: Number.isNaN(categoryId) ? null : categoryId,
          categoryName,
          orderBy,
          direction
        };
        const currentFiltersValue = this.currentFilters();
        // Always check if filters changed
        if (this.hasFiltersChanged(currentFiltersValue, newFilters)) {
          // console.log('[Home] Filters changed! Old:', currentFiltersValue, 'New:', newFilters);
          this.currentFilters.set(newFilters);
          this.fetchAllProducts(newFilters);
        } else if (!this.allProductsLoadedSignal()) {
          // console.log('[Home] First load - fetching products');
          this.currentFilters.set(newFilters);
          this.fetchAllProducts(newFilters);
        } else {
          // console.log('[Home] Filters unchanged, skipping fetch');
        }
      });
  }
  private hasFiltersChanged(current: FilterState, newFilters: FilterState): boolean {
    const changed = (
      current.categoryId !== newFilters.categoryId ||
      current.categoryName !== newFilters.categoryName ||
      current.orderBy !== newFilters.orderBy ||
      current.direction !== newFilters.direction
    );
    // console.log('[Home] hasFiltersChanged:', changed);
    return changed;
  }
  /**
   * Fetch ALL products from API
   */
  private fetchAllProducts(filters: FilterState): void {
    // console.log('[Home] fetchAllProducts called with filters:', filters);
    
    this.loadingSignal.set(true);
    this.allProductsLoadedSignal.set(false);
    this.allProductsCache.set([]);
    this.displayCountSignal.set(this.INITIAL_DISPLAY_COUNT);
    this.cdr.markForCheck();
    // Build filter body
    const body: GetProductsBody = {};
    
    if (filters.categoryId != null && filters.categoryId > 0) {
      body.categoryId = filters.categoryId;
      // console.log('[Home] Adding categoryId to request body:', body.categoryId);
    }
    
    if (filters.categoryName) {
      body.categoryName = filters.categoryName;
      // console.log('[Home] Adding categoryName to request body:', body.categoryName);
    }
    // console.log('[Home] Final request body:', body);
    // Fetch ALL products from API
    this.productService.getProducts(body, { limit: 10000, skip: 0 })
      .pipe(
        finalize(() => {
          this.loadingSignal.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          // console.log(`[Home] ✅ Received ${items.length} products from API`);
          // Store ALL products in cache with UI state
          const products = items.map(p => ({
            ...p,
            isWished: false,
            isAddingToCart: false,
            justAdded: false
          }));
          this.allProductsCache.set(products);
          this.allProductsLoadedSignal.set(true);
          
          // console.log(`[Home] Cached ${this.allProductsCache().length} products. Displaying first ${this.displayedCount()}`);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[Home] ❌ Error fetching products:', err);
          this.allProductsCache.set([]);
          this.allProductsLoadedSignal.set(true);
          this.cdr.markForCheck();
        }
      });
  }
  /**
   * Load More - increase display count by 10
   */
  loadMore(): void {
    if (this.loadingMoreSignal() || !this.hasMore()) {
      // console.log('[Home] Cannot load more - already loading or no more items');
      return;
    }
    // console.log(`[Home] Load More clicked. Currently showing: ${this.displayedCount()}`);
    
    this.loadingMoreSignal.set(true);
    this.cdr.markForCheck();
    setTimeout(() => {
      const currentCount = this.displayCountSignal();
      const newCount = currentCount + this.LOAD_MORE_COUNT;
      this.displayCountSignal.set(newCount);
      this.loadingMoreSignal.set(false);
      
      // console.log(`[Home] Now showing: ${this.displayedCount()} of ${this.allProductsCache().length}`);
      this.cdr.markForCheck();
    }, 300);
  }
  /**
   * Refresh - fetch all products again
   */
  refresh(): void {
    // console.log('[Home] Refresh triggered');
    this.fetchAllProducts(this.currentFilters());
  }
  // ========== Cart Methods ==========
  addToCart(product: ProductCard, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    const itemId: number = Number(product?.itemId ?? product?.id);
    if (!Number.isFinite(itemId)) {
      console.warn('[Home] addToCart: missing itemId on product', product);
      return;
    }
    if (product.isAddingToCart) {
      return;
    }
    product.isAddingToCart = true;
    this.cdr.markForCheck();
    const resolveUnitId = (p: any): number | undefined =>
      Number(p?.itemUnitId) ||
      Number(p?.defaultItemUnitId) ||
      Number(p?.units?.[0]?.itemUnitId);
    const unitId = resolveUnitId(product);
    const source$ = unitId ? of(product) : this.productService.getProductById(itemId);
    source$.pipe(
      switchMap((p: any) => {
        const itemUnitId = resolveUnitId(p);
        if (!itemUnitId) {
          return throwError(() => new Error('No default itemUnitId found'));
        }
        return this.cartManager.addToCart({
          itemId,
          itemUnitId,
          qty: 1,
          note: '',
          modifiers: [],
          displayInfo: {
            itemEnglishName: p.englishName || p.itemEnglishName,
            itemArabicName: p.arabicName || p.itemArabicName,
            unitEnglishName: p.unitEnglishName || p.units?.[0]?.unitEnglishName,
            unitArabicName: p.unitArabicName || p.units?.[0]?.unitArabicName,
            price: p.price || p.salePrice,
            documentName: p.documentName,
            imageUrl: p.fullImageUrl,
          }
        });
      }),
      finalize(() => {
        product.isAddingToCart = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (success) => {
        if (success) {
          const isGuest = !this.auth.isAuthenticated();
          
          product.justAdded = true;
          this.cdr.markForCheck();
          
          setTimeout(() => {
            product.justAdded = false;
            this.cdr.markForCheck();
          }, 2000);
          this.showAddedToast();
          Swal.fire({
            toast: true,
            icon: 'success',
            title: 'Added to cart',
            text: isGuest ? 'Saved locally' : undefined,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true,
          });
          window.dispatchEvent(new CustomEvent('cart:open'));
        }
      },
      error: (err) => {
        console.error('[Home] Add to cart failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Oops',
          text: err?.message || 'Could not add to cart.',
          timer: 3000,
          showConfirmButton: false,
        });
      }
    });
  }
  private showAddedToast(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.showCartToast = true;
    this.cdr.markForCheck();
    this.toastTimeout = setTimeout(() => {
      this.showCartToast = false;
      this.cdr.markForCheck();
    }, 3000);
  }
  toggleWishlist(product: ProductCard, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    
    product.isWished = !product.isWished;
    this.cdr.markForCheck();
    Swal.fire({
      toast: true,
      icon: product.isWished ? 'success' : 'info',
      title: product.isWished ? 'Added to wishlist' : 'Removed from wishlist',
      position: 'top-end',
      showConfirmButton: false,
      timer: 1200,
    });
  }
  quickView(product: ProductCard, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    
    window.dispatchEvent(new CustomEvent('product:quickview', {
      detail: { productId: product.itemId }
    }));
  }
  trackByProductId = (_: number, product: ProductCard): number => {
    return product.itemId || product.id || 0;
  };
  /**
 * Check if product is a booking/service type
 */
isBookingProduct(product: ProductCard): boolean {
  return product.itemType === this.ITEM_TYPE_BOOKING;
}
/**
 * Check if product is for sale
 */
isSaleProduct(product: ProductCard): boolean {
  return product.itemType !== this.ITEM_TYPE_BOOKING;
}
/**
 * Handle Book Now action for service/booking products
 */
bookNow(product: ProductCard, event?: Event): void {
  event?.stopPropagation();
  event?.preventDefault();
  const itemId: number = Number(product?.itemId ?? product?.id);
  if (!Number.isFinite(itemId)) {
    console.warn('[Home] bookNow: missing itemId on product', product);
    return;
  }
  if (product.isBooking) {
    return;
  }
  product.isBooking = true;
  this.cdr.markForCheck();
  // Option 1: Navigate to booking page with product data
  this.router.navigate(['/booking-Checkout'], {
    queryParams: { 
      itemId: itemId,
      itemUnitId: product.itemUnitId || product.units?.[0]?.itemUnitId
    },
    state: { product } // Pass full product data via router state
  });
  // Reset loading state after navigation
  setTimeout(() => {
    product.isBooking = false;
    this.cdr.markForCheck();
  }, 500);
}
/**
 * Alternative: Open booking modal/dialog
 */
openBookingModal(product: ProductCard, event?: Event): void {
  event?.stopPropagation();
  event?.preventDefault();
  const itemId: number = Number(product?.itemId ?? product?.id);
  if (!Number.isFinite(itemId)) {
    console.warn('[Home] openBookingModal: missing itemId on product', product);
    return;
  }
  // Dispatch custom event to open booking modal
  window.dispatchEvent(new CustomEvent('booking:open', {
    detail: { 
      product,
      itemId,
      itemUnitId: product.itemUnitId || product.units?.[0]?.itemUnitId
    }
  }));
}
}

