// src/app/pages/product-details/product-details.ts

import { 
  Component, 
  ChangeDetectionStrategy, 
  inject,
  ChangeDetectorRef,
  DestroyRef,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { ProductService } from '../../services/product';
import { CartManagerService } from '../../services/cart-manager';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type VariantValue = {
  attributeValueId: number;
  attributeValueArabicName: string;
  attributeValueEnglishName: string;
  dataArabicAttribute: string[];
  dataEnglishAttribute: string[];
};

type VariantAttr = {
  attributeId: number;
  attributeArabicName: string;
  attributeEnglishName: string;
  order: number;
  nextAttId: number;
  nextAttOrder: number;
  attributeValues: VariantValue[];
};

type SizeOption = {
  name: string;
  allowedColors: string[];
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetails {
  // ─────────────────────────────────────────────────────────────────────────
  // INJECTABLES
  // ─────────────────────────────────────────────────────────────────────────
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  readonly cartManager = inject(CartManagerService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly ITEM_TYPE_BOOKING = 2;
  isBooking = false;
  justBooked = false;
  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  readonly product$: Observable<any>;
  readonly related$: Observable<any[]>;
  readonly isLoggedIn$ = this.auth.loggedIn$;

  selectedUnitId?: number;
  selectedModifiers = new Set<number>();
  selectedColor?: string;
  selectedSize?: string;
  qty = 1;

  // Cart UI State
  isAddingToCart = false;
  justAdded = false;
  showCartToast = false;
  private toastTimeout: any;

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  constructor() {
    this.product$ = this.route.paramMap.pipe(
      map(p => Number(p.get('itemId'))),
      switchMap(itemId => this.productService.getProductById(itemId)),
      map(prod => this.normalizeProduct(prod))
    );

    this.related$ = this.product$.pipe(
      switchMap(prod => this.loadRelatedProducts(prod))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA NORMALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  private normalizeProduct(prod: any) {
    const units = Array.isArray(prod.units)
      ? prod.units.map((u: any) => ({
          ...u,
          displayName: u.englishName || u.arabicName,
          price: u.itemUnitPrice,
          imageUrl: u.image
            ? `${environment.imageBase}${u.image}`
            : (prod.fullImageUrl || 'assets/images/placeholder.jpg'),
        }))
      : [];

    const modifiers = Array.isArray(prod.modifiers)
      ? prod.modifiers.map((m: any) => ({
          ...m,
          displayName: m.englishName || m.arabicName,
          price: Number(m.price) || 0
        }))
      : [];

    // Pre-select first unit
    if (!this.selectedUnitId && units.length) {
      this.selectedUnitId = units[0].itemUnitId;
    }

    return {
      ...prod,
      id: prod.itemId,
      englishName: prod.englishName,
      arabicName: prod.arabicName,
      unitEnglishName: prod.unitEnglishName,
      unitArabicName: prod.unitArabicName,
      categoryId: prod.itemCategoryId,
      categoryName: prod.categoryEnglishName ?? prod.categoryArabicName,
      price: prod.price,
      images: prod.fullImageUrl ? [prod.fullImageUrl] : [],
      units,
      modifiers,
      itemVariants: Array.isArray(prod.itemVariants) ? prod.itemVariants : [],
      isWished: false,
    };
  }

  private loadRelatedProducts(prod: any): Observable<any[]> {
    const opts = { limit: 12, skip: 0, orderBy: 'Price', direction: 'asc' as const };

    if (prod?.categoryId != null) {
      return this.productService.getProductsByCategoryId(prod.categoryId, opts)
        .pipe(map(list => this.filterRelated(list, prod.id)));
    }
    if (prod?.categoryName) {
      return this.productService.getProductsByCategoryName(prod.categoryName, opts)
        .pipe(map(list => this.filterRelated(list, prod.id)));
    }
    return of([]);
  }

  private filterRelated(list: any[], currentId: number) {
    return list.filter((p: any) => (p.itemId ?? p.id) !== currentId).slice(0, 9);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  getColors(product: any): string[] {
    const colorAttr = this.findAttr(product, 'color');
    return colorAttr?.attributeValues?.map(v => v.attributeValueEnglishName) ?? [];
  }

  getSizes(product: any): string[] {
    const sizeAttr = this.findAttr(product, 'size');
    if (!sizeAttr) return [];

    const allSizes: SizeOption[] = sizeAttr.attributeValues?.map(v => ({
      name: v.attributeValueEnglishName,
      allowedColors: v.dataEnglishAttribute ?? []
    })) ?? [];

    if (!this.selectedColor) return allSizes.map(s => s.name);
    return allSizes
      .filter(s => s.allowedColors.includes(this.selectedColor!))
      .map(s => s.name);
  }

  private findAttr(product: any, name: string): VariantAttr | undefined {
    return (product.itemVariants as VariantAttr[] || [])
      .find(a => (a.attributeEnglishName || '').toLowerCase() === name.toLowerCase());
  }

  private valueIdByName(product: any, attrName: string, valName?: string): number | undefined {
    if (!valName) return undefined;
    const attr = this.findAttr(product, attrName);
    return attr?.attributeValues?.find(
      x => (x.attributeValueEnglishName || '').toLowerCase() === valName.toLowerCase()
    )?.attributeValueId;
  }

  private buildVariantIds(product: any) {
    const v1 = this.valueIdByName(product, 'Color', this.selectedColor);
    const v2 = this.valueIdByName(product, 'Size', this.selectedSize);
    return {
      ...(v1 ? { variantAttributeValueId1: v1 } : {}),
      ...(v2 ? { variantAttributeValueId2: v2 } : {}),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRICE & IMAGE HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  currentImage(product: any): string {
    const u = (product.units || []).find((x: any) => x.itemUnitId === this.selectedUnitId);
    return u?.imageUrl || product.fullImageUrl || 'assets/images/placeholder.jpg';
  }

  currentBasePrice(product: any): number {
    const u = (product.units || []).find((x: any) => x.itemUnitId === this.selectedUnitId);
    return Number(u?.price ?? product.price ?? 0);
  }

  modifiersTotal(product: any): number {
    if (!Array.isArray(product.modifiers) || !this.selectedModifiers.size) return 0;
    return product.modifiers
      .filter((m: any) => this.selectedModifiers.has(m.modifierId))
      .reduce((sum: number, m: any) => sum + (Number(m.price) || 0), 0);
  }

  calcPrice(product: any): number {
    const total = this.currentBasePrice(product) + this.modifiersTotal(product);
    return Number(total.toFixed(3));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  setColor(c: string, product: any) {
    this.selectedColor = c;
    const validSizes = new Set(this.getSizes(product));
    if (this.selectedSize && !validSizes.has(this.selectedSize)) {
      this.selectedSize = undefined;
    }
  }

  setSize(s: string) { this.selectedSize = s; }
  selectUnit(id: number) { this.selectedUnitId = id; }
  
  toggleModifier(id: number) {
    this.selectedModifiers.has(id)
      ? this.selectedModifiers.delete(id)
      : this.selectedModifiers.add(id);
  }

  inc() { this.qty++; }
  dec() { if (this.qty > 1) this.qty--; }

  toggleWishlist(product: any, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    
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

  // ─────────────────────────────────────────────────────────────────────────
  // CART ACTIONS (Same pattern as Home)
  // ─────────────────────────────────────────────────────────────────────────
  
  buyNow(product: any) {
    this.addToCart(product, true);
  }

  addToCart(product: any, isBuyNow: boolean = false): void {
    if (this.isAddingToCart) {
      return;
    }

    const itemId = Number(product?.itemId ?? product?.id);
    if (!Number.isFinite(itemId)) {
      console.warn('[ProductDetails] addToCart: missing itemId on product', product);
      return;
    }

    this.isAddingToCart = true;
    this.cdr.markForCheck();

    // Resolve unit ID
    const resolveUnitId = (p: any): number | undefined =>
      this.selectedUnitId ||
      Number(p?.itemUnitId) ||
      Number(p?.defaultItemUnitId) ||
      Number(p?.units?.[0]?.itemUnitId);

    const itemUnitId = resolveUnitId(product);
    
    if (!itemUnitId) {
      this.isAddingToCart = false;
      this.cdr.markForCheck();
      Swal.fire({
        icon: 'error',
        title: 'Oops',
        text: 'No unit selected. Please select a unit.',
        timer: 3000,
        showConfirmButton: false,
      });
      return;
    }

    // Get selected unit info
    const selectedUnit = (product.units || []).find((u: any) => u.itemUnitId === itemUnitId);
    const finalPrice = this.calcPrice(product);

    // Build variant IDs
    const variantIds = this.buildVariantIds(product);

    this.cartManager.addToCart({
      itemId,
      itemUnitId,
      qty: this.qty,
      note: '',
      modifiers: Array.from(this.selectedModifiers.values()),
      ...variantIds,
      displayInfo: {
        itemEnglishName: product.englishName || product.itemEnglishName,
        itemArabicName: product.arabicName || product.itemArabicName,
        unitEnglishName: selectedUnit?.displayName || product.unitEnglishName || product.units?.[0]?.unitEnglishName,
        unitArabicName: selectedUnit?.arabicName || product.unitArabicName || product.units?.[0]?.unitArabicName,
        price: finalPrice,
        documentName: product.documentName,
        imageUrl: product.fullImageUrl,
      }
    }).pipe(
      finalize(() => {
        this.isAddingToCart = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (success) => {
        if (success) {
          const isGuest = !this.auth.isAuthenticated();

          if (isBuyNow) {
            this.router.navigate(['/checkout']);
          } else {
            // Show success animation
            this.justAdded = true;
            this.cdr.markForCheck();
            
            setTimeout(() => {
              this.justAdded = false;
              this.cdr.markForCheck();
            }, 2000);

            // Show toast
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

            // Open cart drawer
            window.dispatchEvent(new CustomEvent('cart:open'));
          }
        }
      },
      error: (err) => {
        console.error('[ProductDetails] Add to cart failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Oops',
          text: err?.message || err?.error?.msgEN || 'Could not add to cart.',
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

  // Add to cart for related products (same pattern as home)
  addRelatedToCart(product: any, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const itemId: number = Number(product?.itemId ?? product?.id);
    if (!Number.isFinite(itemId)) {
      console.warn('[ProductDetails] addRelatedToCart: missing itemId on product', product);
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
        console.error('[ProductDetails] Add related to cart failed', err);
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



  //booking now 
  bookNow(product: any, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    
    if (this.isBooking) { 
      return;
    }
    
    // Get selected unit ID from units array
    const selectedItemUnitId = this.selectedUnitId || product.units?.[0]?.itemUnitId;
    
    if (!selectedItemUnitId) {
      console.warn('[ProductDetails] bookNow: no itemUnitId found');
      return;
    }
    
    this.isBooking = true;
    this.cdr.markForCheck();
    
    this.router.navigate(['/booking-Checkout'], {
      queryParams: { 
        itemUnitId: selectedItemUnitId
      },
      state: { product }
    });
    
    setTimeout(() => {
      this.isBooking = false;
      this.cdr.markForCheck();
    }, 500);
  }


  
}