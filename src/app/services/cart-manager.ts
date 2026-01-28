// src/app/services/cart-manager.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, forkJoin, BehaviorSubject } from 'rxjs';
import {
  map, tap, catchError, switchMap, finalize,
  take, timeout
} from 'rxjs/operators';
import { ProductService, AddItemCartBody } from './product';
import { GuestCartService, GuestCartItem } from './guest-cart';
import { AuthService } from './auth';

export interface CartItem {
  id: number | string;
  itemId: number;
  name: string;
  unitName?: string;
  qty: number;
  price: number;
  lineTotal: number;
  note?: string;
  variant?: string;
  imageUrl: string;
  isLocal: boolean;
  raw: any;
}

@Injectable({ providedIn: 'root' })
export class CartManagerService {
  private readonly productSvc = inject(ProductService);
  private readonly guestCart = inject(GuestCartService);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ========== State ==========
  private readonly loadingSubj = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubj.asObservable();

  private readonly itemsSubj = new BehaviorSubject<CartItem[]>([]);
  readonly items$ = this.itemsSubj.asObservable();

  private readonly syncingSubj = new BehaviorSubject<boolean>(false);
  readonly syncing$ = this.syncingSubj.asObservable();

  private readonly PLACEHOLDER = 'assets/images/placeholder.jpg';

  private hasSynced = false;

  // ========== Image Cache for Server Cart ==========
  private imageCache = new Map<number, string>();

  // ========== Computed Observables ==========
  readonly cartQty$ = this.items$.pipe(
    map(items => items.reduce((sum, i) => sum + i.qty, 0))
  );

  readonly subTotal$ = this.items$.pipe(
    map(items => +items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(3))
  );

  readonly itemCount$ = this.items$.pipe(
    map(items => items.length)
  );

  constructor() {
    if (this.isBrowser) {
      this.auth.loggedIn$.subscribe(isLoggedIn => {
        console.log('Auth state changed:', isLoggedIn);
        
        if (isLoggedIn && !this.guestCart.isEmpty() && !this.hasSynced) {
          console.log('User logged in with guest cart items, starting sync...');
          this.syncGuestCartToServer();
        } else if (isLoggedIn) {
          this.loadCart();
        } else if (!isLoggedIn) {
          this.hasSynced = false;
          this.syncingSubj.next(false);
          this.loadGuestCart();
        }
      });
    }
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  loadCart(): void {
    if (!this.isBrowser) return;

    this.loadingSubj.next(true);

    if (this.isAuthenticated) {
      this.loadServerCart();
    } else {
      this.loadGuestCart();
    }
  }

  addToCart(params: {
    itemId: number;
    itemUnitId: number;
    qty?: number;
    note?: string;
    modifiers?: number[];
    variantAttributeValueId1?: number;
    variantAttributeValueId2?: number;
    variantAttributeValueId3?: number;
    variantAttributeValueId4?: number;
    variantAttributeValueId5?: number;
    variantAttributeValueId6?: number;
    displayInfo?: {
      itemEnglishName?: string;
      itemArabicName?: string;
      unitEnglishName?: string;
      unitArabicName?: string;
      price?: number;
      documentName?: string;
      imageUrl?: string;
      variantEnglishName?: string;
      variantArabicName?: string;
    };
  }): Observable<boolean> {
    const { displayInfo, ...cartData } = params;
    const qty = params.qty ?? 1;
    const modifiers = params.modifiers ?? [];

    if (this.isAuthenticated) {
      const body: AddItemCartBody = {
        itemId: params.itemId,
        itemUnitId: params.itemUnitId,
        qty,
        note: params.note,
        modifiers,
        ...(params.variantAttributeValueId1 && { variantAttributeValueId1: params.variantAttributeValueId1 }),
        ...(params.variantAttributeValueId2 && { variantAttributeValueId2: params.variantAttributeValueId2 }),
        ...(params.variantAttributeValueId3 && { variantAttributeValueId3: params.variantAttributeValueId3 }),
        ...(params.variantAttributeValueId4 && { variantAttributeValueId4: params.variantAttributeValueId4 }),
        ...(params.variantAttributeValueId5 && { variantAttributeValueId5: params.variantAttributeValueId5 }),
        ...(params.variantAttributeValueId6 && { variantAttributeValueId6: params.variantAttributeValueId6 }),
      };

      return this.productSvc.addItemToCart(body).pipe(
        tap(() => this.loadCart()),
        map(() => true),
        catchError(err => {
          console.error('Failed to add to server cart', err);
          return of(false);
        })
      );
    } else {
      try {
        this.guestCart.addItem({
          itemId: params.itemId,
          itemUnitId: params.itemUnitId,
          qty,
          note: params.note,
          modifiers,
          ...(params.variantAttributeValueId1 && { variantAttributeValueId1: params.variantAttributeValueId1 }),
          ...(params.variantAttributeValueId2 && { variantAttributeValueId2: params.variantAttributeValueId2 }),
          ...(params.variantAttributeValueId3 && { variantAttributeValueId3: params.variantAttributeValueId3 }),
          ...(params.variantAttributeValueId4 && { variantAttributeValueId4: params.variantAttributeValueId4 }),
          ...(params.variantAttributeValueId5 && { variantAttributeValueId5: params.variantAttributeValueId5 }),
          ...(params.variantAttributeValueId6 && { variantAttributeValueId6: params.variantAttributeValueId6 }),
          ...displayInfo,
        });
        this.loadGuestCart();
        return of(true);
      } catch (e) {
        console.error('Failed to add to guest cart', e);
        return of(false);
      }
    }
  }

  updateQty(item: CartItem, newQty: number): Observable<boolean> {
    if (newQty < 1) return of(false);

    if (item.isLocal) {
      const success = this.guestCart.updateQty(item.id as string, newQty);
      if (success) this.loadGuestCart();
      return of(success);
    } else {
      const prevQty = item.qty;
      this.updateItemLocally(item.id, { qty: newQty });

      return this.productSvc.updateCartItem(item.id as number, newQty).pipe(
        map(() => true),
        catchError(err => {
          this.updateItemLocally(item.id, { qty: prevQty });
          console.error('Failed to update quantity', err);
          return of(false);
        })
      );
    }
  }

  removeItem(item: CartItem): Observable<boolean> {
    if (item.isLocal) {
      const success = this.guestCart.removeItem(item.id as string);
      if (success) this.loadGuestCart();
      return of(success);
    } else {
      const prevItems = this.itemsSubj.value;
      this.itemsSubj.next(prevItems.filter(i => i.id !== item.id));

      return this.productSvc.deleteCartItem(item.id as number).pipe(
        map(() => true),
        catchError(err => {
          this.itemsSubj.next(prevItems);
          console.error('Failed to remove item', err);
          return of(false);
        })
      );
    }
  }

  clearCart(): Observable<boolean> {
    if (!this.isAuthenticated) {
      this.guestCart.clearCart();
      this.itemsSubj.next([]);
      return of(true);
    }

    const prevItems = this.itemsSubj.value;
    this.itemsSubj.next([]);

    return this.productSvc.clearCart().pipe(
      map(() => true),
      catchError(err => {
        this.itemsSubj.next(prevItems);
        console.error('Failed to clear cart', err);
        return of(false);
      })
    );
  }

  syncGuestCartToServer(): void {
    const guestItems = this.guestCart.getItemsForSync();

    if (guestItems.length === 0) {
      console.log('No guest items to sync');
      this.hasSynced = true;
      this.loadCart();
      return;
    }

    console.log(`Starting sync of ${guestItems.length} guest cart items...`);
    this.syncingSubj.next(true);

    let completedCount = 0;
    let failedCount = 0;

    const processNext = (index: number) => {
      if (index >= guestItems.length) {
        console.log(`Sync completed: ${completedCount} succeeded, ${failedCount} failed`);
        this.finishSync();
        return;
      }

      const item = guestItems[index];

      this.productSvc.addItemToCart({
        itemId: item.itemId,
        itemUnitId: item.itemUnitId,
        qty: item.qty,
        note: item.note,
        modifiers: item.modifiers || [],
        ...(item.variantAttributeValueId1 && { variantAttributeValueId1: item.variantAttributeValueId1 }),
        ...(item.variantAttributeValueId2 && { variantAttributeValueId2: item.variantAttributeValueId2 }),
        ...(item.variantAttributeValueId3 && { variantAttributeValueId3: item.variantAttributeValueId3 }),
        ...(item.variantAttributeValueId4 && { variantAttributeValueId4: item.variantAttributeValueId4 }),
        ...(item.variantAttributeValueId5 && { variantAttributeValueId5: item.variantAttributeValueId5 }),
        ...(item.variantAttributeValueId6 && { variantAttributeValueId6: item.variantAttributeValueId6 }),
      }).pipe(
        timeout(10000),
        take(1)
      ).subscribe({
        next: () => {
          completedCount++;
          setTimeout(() => processNext(index + 1), 100);
        },
        error: (err) => {
          failedCount++;
          console.warn(`Failed to sync item ${item.itemId}:`, err);
          setTimeout(() => processNext(index + 1), 100);
        }
      });
    };

    processNext(0);
  }

  private finishSync(): void {
    this.guestCart.clearCart();
    this.syncingSubj.next(false);
    this.hasSynced = true;
    this.loadCart();
  }

  refresh(): void {
    this.loadCart();
  }

  getItems(): CartItem[] {
    return this.itemsSubj.value;
  }

  isEmpty(): boolean {
    return this.itemsSubj.value.length === 0;
  }

  // ========== Private Methods ==========

  private loadServerCart(): void {
    console.log('Loading server cart...');
    
    this.productSvc.getCart().pipe(
      timeout(15000),
      take(1),
      switchMap(rows => {
        // First map items with whatever image data we have
        const items = this.mapServerRowsToCartItems(rows);
        
        // Find items that need image lookup
        const itemsNeedingImages = items.filter(item => 
          item.imageUrl === this.PLACEHOLDER && !this.imageCache.has(item.itemId)
        );

        if (itemsNeedingImages.length === 0) {
          // Apply cache and return
          return of(this.applyImageCache(items));
        }

        // Fetch missing images
        const uniqueItemIds = [...new Set(itemsNeedingImages.map(i => i.itemId))];
        console.log('Fetching images for', uniqueItemIds.length, 'products');

        return forkJoin(
          uniqueItemIds.map(id =>
            this.productSvc.getProductById(id).pipe(
              timeout(10000),
              map(product => ({ itemId: id, product })),
              catchError(() => of({ itemId: id, product: null }))
            )
          )
        ).pipe(
          map(results => {
            // Cache the images
            results.forEach(({ itemId, product }) => {
              if (product?.fullImageUrl) {
                this.imageCache.set(itemId, product.fullImageUrl);
              } else if (product?.documentName) {
                this.imageCache.set(itemId, this.productSvc.buildImageUrl(product.documentName));
              }
            });
            // Apply cache to items
            return this.applyImageCache(items);
          })
        );
      }),
      catchError(err => {
        console.error('Failed to load server cart', err);
        return of([]);
      }),
      finalize(() => {
        this.loadingSubj.next(false);
      })
    ).subscribe(items => {
      console.log('Server cart loaded:', items.length, 'items');
      this.itemsSubj.next(items);
    });
  }

  private applyImageCache(items: CartItem[]): CartItem[] {
    return items.map(item => {
      const cachedImage = this.imageCache.get(item.itemId);
      if (cachedImage && item.imageUrl === this.PLACEHOLDER) {
        return { ...item, imageUrl: cachedImage };
      }
      return item;
    });
  }

  private loadGuestCart(): void {
    console.log('Loading guest cart...');
    
    const guestItems = this.guestCart.getItems();

    if (guestItems.length === 0) {
      this.itemsSubj.next([]);
      this.loadingSubj.next(false);
      return;
    }

    const itemsNeedingDetails = guestItems.filter(i => !i.price || !i.imageUrl);

    if (itemsNeedingDetails.length === 0) {
      const items = this.mapGuestItemsToCartItems(guestItems);
      this.itemsSubj.next(items);
      this.loadingSubj.next(false);
      return;
    }

    const uniqueItemIds = [...new Set(itemsNeedingDetails.map(i => i.itemId))];

    forkJoin(
      uniqueItemIds.map(id =>
        this.productSvc.getProductById(id).pipe(
          timeout(10000),
          catchError(() => of(null))
        )
      )
    ).pipe(
      take(1),
      finalize(() => this.loadingSubj.next(false))
    ).subscribe({
      next: (products) => {
        const productMap = new Map(
          products
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .map(p => [p.itemId, p])
        );

        const updatedGuestItems = guestItems.map(item => {
          const product = productMap.get(item.itemId);
          if (product) {
            return {
              ...item,
              itemEnglishName: item.itemEnglishName || product.englishName || product.itemEnglishName,
              itemArabicName: item.itemArabicName || product.arabicName || product.itemArabicName,
              price: item.price || product.price || product.salePrice || 0,
              imageUrl: item.imageUrl || product.fullImageUrl,
              documentName: item.documentName || product.documentName,
            };
          }
          return item;
        });

        const items = this.mapGuestItemsToCartItems(updatedGuestItems);
        this.itemsSubj.next(items);
      },
      error: () => {
        const items = this.mapGuestItemsToCartItems(guestItems);
        this.itemsSubj.next(items);
      }
    });
  }

  private mapServerRowsToCartItems(rows: any[]): CartItem[] {
    return (rows ?? []).map(r => {
      const qty = Number(r.qty) || 1;
      const price = Number(r.price) || 0;
      
      // Try multiple possible image field names from server response
      const imageUrl = this.extractImageUrl(r);
      
      return {
        id: r.id,
        itemId: r.itemId,
        name: r.itemEnglishName || r.itemArabicName || r.englishName || r.arabicName || 'Item',
        unitName: r.unitEnglishName || r.unitArabicName,
        qty,
        price,
        lineTotal: +(price * qty).toFixed(3),
        note: r.note,
        variant: r.variantEnglishName || r.variantArabicName || '',
        imageUrl,
        isLocal: false,
        raw: r
      };
    });
  }

  /**
   * Extract image URL from various possible API response fields
   */
  private extractImageUrl(row: any): string {
    // Check cache first
    if (this.imageCache.has(row.itemId)) {
      return this.imageCache.get(row.itemId)!;
    }

    // Try various field names that might contain the image
    const possibleFields = [
      'imageUrl',
      'image',
      'itemImage',
      'productImage',
      'fullImageUrl',
      'imagePath',
      'imageURL',
      'img',
      'photo',
      'picture',
      'thumbnail'
    ];

    for (const field of possibleFields) {
      const value = row[field];
      if (value && typeof value === 'string' && value.trim()) {
        // Check if it's a full URL or just a filename
        if (value.startsWith('http') || value.startsWith('//')) {
          return value;
        }
        // Build full URL from document name
        return this.productSvc.buildImageUrl(value);
      }
    }

    // Try documentName as fallback
    if (row.documentName && typeof row.documentName === 'string' && row.documentName.trim()) {
      return this.productSvc.buildImageUrl(row.documentName);
    }

    // Return placeholder - will be replaced after fetching product details
    return this.PLACEHOLDER;
  }

  private mapGuestItemsToCartItems(items: GuestCartItem[]): CartItem[] {
    return items.map(i => {
      const qty = i.qty || 1;
      const price = i.price ?? 0;
      return {
        id: i.localId,
        itemId: i.itemId,
        name: i.itemEnglishName || i.itemArabicName || `Item #${i.itemId}`,
        unitName: i.unitEnglishName || i.unitArabicName,
        qty,
        price,
        lineTotal: +(price * qty).toFixed(3),
        note: i.note,
        variant: i.variantEnglishName || i.variantArabicName || '',
        imageUrl: i.imageUrl?.trim()
          ? i.imageUrl
          : this.productSvc.buildImageUrl(i.documentName),
        isLocal: true,
        raw: i
      };
    });
  }

  private updateItemLocally(id: number | string, updates: Partial<CartItem>): void {
    const items = this.itemsSubj.value.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        updated.lineTotal = +(updated.price * updated.qty).toFixed(3);
        return updated;
      }
      return item;
    });
    this.itemsSubj.next(items);
  }
}