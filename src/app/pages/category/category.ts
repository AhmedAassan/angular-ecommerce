// import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
// import { ActivatedRoute, RouterModule } from '@angular/router';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Observable } from 'rxjs';
// import { map, switchMap } from 'rxjs/operators';

// import { ProductService } from '../../services/product';

// @Component({
//   selector: 'app-category',
//   standalone: true,
//   imports: [CommonModule, RouterModule, FormsModule],
//   templateUrl: './category.html',
//   styleUrl: './category.scss',
//   changeDetection: ChangeDetectionStrategy.OnPush,
//   encapsulation: ViewEncapsulation.None,
// })
// export class Category {
//   /* ───── UI state ───── */
//   showFilter = false;
//   showSort = false;

//   /** examples: '', 'price.asc', 'price.desc', 'itemOrdering.asc', 'englishName.asc' */
//   sortKey = '';

//   /** filter inputs */
//   minPrice: number | null | undefined;
//   maxPrice: number | null | undefined;
//   inStockOnly = false;   // (not supported server-side yet)
//   outOfStockOnly = false;

//   /* ───── products stream ───── */
//   products$!: Observable<any[]>;

//   /* ───── sort menu ───── */
//   readonly sortOptions = [
//     { key: '', label: 'Default sorting' },
//     { key: 'Price.asc', label: 'Price: low to high' },
//     { key: 'Price.desc', label: 'Price: high to low' },
//     { key: 'EnglishNAme.asc', label: 'Name  A→Z' },
//     // { key: 'ArabicName.asc', label: 'Name (Arabic) A→Z' },
//     // { key: 'CategoryEnglishName.asc', label: 'Category (English) A→Z' },
//     // { key: 'CategoryArabicName.asc', label: 'Category (Arabic) A→Z' },
//   ];

//   constructor(
//     private route: ActivatedRoute,
//     private productSvc: ProductService,
//   ) {
//     this.reload();
//   }

//   /* ====================================================================
//      (re)-build products$ whenever route/sort/filters change
//      ==================================================================== */
//   reload(): void {
//     // category.ts (inside reload())
//     this.products$ = this.route.paramMap.pipe(
//       map(pm => (pm.get('id') ?? pm.get('slug') ?? '').trim()),   // <- prefer :id
//       switchMap(key => {
//         const [orderBy = '', rawOrder = ''] = this.sortKey.split('.');
//         const direction = (rawOrder === 'asc' || rawOrder === 'desc')
//           ? (rawOrder as 'asc' | 'desc')
//           : undefined;
//         const opts = { orderBy: orderBy || undefined, direction, limit: 60, skip: 0 };

//         if (!key) return this.productSvc.getAllProducts(opts);

//         const id = Number(key);
//         if (Number.isFinite(id)) {
//           return this.productSvc.getProductsByCategoryId(id, opts);  // numeric → categoryId
//         }
//         return this.productSvc.getProductsByCategoryName(key, opts); // fallback by name
//       }),
//       map(products => products.filter((p: any) => {
//         const price = Number(p.price);
//         const okMin = this.minPrice == null || (Number.isFinite(price) && price >= this.minPrice!);
//         const okMax = this.maxPrice == null || (Number.isFinite(price) && price <= this.maxPrice!);
//         return okMin && okMax;
//       }))
//     );

//   }

//   /* ───── sort & filter helpers ───── */
//   applySort(): void { this.reload(); this.showSort = false; }
//   applyFilters(): void { this.reload(); this.showFilter = false; }

//   resetAll(): void {
//     this.minPrice = this.maxPrice = undefined;
//     this.inStockOnly = this.outOfStockOnly = false;
//     this.sortKey = '';
//     this.reload();
//   }

//   activeCount(): number {
//     let c = 0;
//     if (this.minPrice != null) c++;
//     if (this.maxPrice != null) c++;
//     if (this.inStockOnly) c++;
//     if (this.outOfStockOnly) c++;
//     return c;
//   }

//   addToCart(product: any, event: Event): void {
//     event.stopPropagation();
//     event.preventDefault();
//     console.log('Add to cart', product);
//   }

//   toggleWishlist(product: any, event: Event): void {
//     event.stopPropagation();
//     event.preventDefault();
//     product.isWished = !product.isWished;
//   }

//   toggleSection(section: 'filter' | 'sort') {
//     if (section === 'filter') this.showFilter = !this.showFilter;
//     else this.showSort = !this.showSort;
//   }

//   getSectionStyle(expanded: boolean, element: HTMLElement | null): any {
//     if (!element) return {};
//     const height = element.scrollHeight;
//     return {
//       height: expanded ? height + 'px' : '0px',
//       opacity: expanded ? 1 : 0,
//       overflow: 'hidden',
//       transition: 'height 0.4s ease, opacity 0.3s ease'
//     };
//   }
// }

// src/app/pages/category/category.ts
import { Component, ChangeDetectionStrategy, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { ProductService } from '../../services/product';
import Swal from 'sweetalert2';

type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './category.html',
  styleUrl: './category.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class Category {

  
  /* ───── UI state ───── */
  showFilter = false;
  showSort = false;

  /** examples: '', 'Price.asc', 'Price.desc', 'EnglishName.asc' */
  sortKey = '';

  /** filter inputs */
  minPrice: number | null | undefined;
  maxPrice: number | null | undefined;
  inStockOnly = false;   // (not supported server-side yet)
  outOfStockOnly = false;

  readonly ITEM_TYPE_BOOKING = 2;
  /* ───── products stream ───── */
  products$!: Observable<any[]>;

  /* ───── sort menu ───── */
  readonly sortOptions = [
    { key: '',                label: 'Default sorting' },
    { key: 'Price.asc',       label: 'Price: low to high' },
    { key: 'Price.desc',      label: 'Price: high to low' },
    { key: 'EnglishName.asc', label: 'Name  A→Z' },
    // { key: 'ArabicName.asc',         label: 'Name (Arabic) A→Z' },
    // { key: 'CategoryEnglishName.asc',label: 'Category (English) A→Z' },
    // { key: 'CategoryArabicName.asc', label: 'Category (Arabic) A→Z' },
  ] as const;
  
  constructor(
    private route: ActivatedRoute,
    private productSvc: ProductService,
    private router: Router,
    private cdr: ChangeDetectorRef,  
  ) {
  this.reload();
  }

  /* ====================================================================
     (re)-build products$ whenever route/sort/filters change
     ==================================================================== */
  reload(): void {
    this.products$ = this.route.paramMap.pipe(
      map(pm => (pm.get('id') ?? pm.get('slug') ?? '').trim()),   // prefer :id, fallback :slug
      switchMap(key => {
        const [orderByRaw = '', rawOrder = ''] = this.sortKey.split('.');
        const orderBy = orderByRaw || undefined;
        const direction: SortDir | undefined =
          rawOrder === 'asc' || rawOrder === 'desc' ? (rawOrder as SortDir) : undefined;

        const opts = { orderBy, direction, limit: 60, skip: 0 };

        if (!key) return this.productSvc.getAllProducts(opts);

        const id = Number(key);
        if (Number.isFinite(id)) {
          return this.productSvc.getProductsByCategoryId(id, opts);  // numeric → categoryId
        }
        return this.productSvc.getProductsByCategoryName(key, opts); // fallback by name
      }),
      map(products =>
        products.filter((p: any) => {
          const price = Number(p.price);
          const okMin =
            this.minPrice == null || (Number.isFinite(price) && price >= this.minPrice!);
          const okMax =
            this.maxPrice == null || (Number.isFinite(price) && price <= this.maxPrice!);
          // TODO: apply stock filters when backend supports them
          return okMin && okMax;
        })
      )
    );
  }

  /* ───── sort & filter helpers ───── */
  applySort(): void { this.reload(); this.showSort = false; }
  applyFilters(): void { this.reload(); this.showFilter = false; }

  resetAll(): void {
    this.minPrice = this.maxPrice = undefined;
    this.inStockOnly = this.outOfStockOnly = false;
    this.sortKey = '';
    this.reload();
  }

  activeCount(): number {
    let c = 0;
    if (this.minPrice != null) c++;
    if (this.maxPrice != null) c++;
    if (this.inStockOnly) c++;
    if (this.outOfStockOnly) c++;
    return c;
  }

  /* ====================================================================
     Add to cart from a grid card
     - Products list usually lacks itemUnitId; fetch details once if needed
     - After success: toast + open drawer (window event)
     ==================================================================== */
  addToCart(product: any, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const itemId: number = Number(product?.itemId ?? product?.id);
    if (!Number.isFinite(itemId)) {
      console.warn('addToCart: missing itemId on product', product);
      return;
    }

    const resolveUnitId = (p: any): number | undefined =>
      Number(p?.itemUnitId) ||
      Number(p?.defaultItemUnitId) ||
      Number(p?.units?.[0]?.itemUnitId);

    const source$ = resolveUnitId(product)
      ? of(product)
      : this.productSvc.getProductById(itemId);

    source$.pipe(
      switchMap((p: any) => {
        const itemUnitId = resolveUnitId(p);
        if (!itemUnitId) {
          return throwError(() => new Error('No default itemUnitId'));
        }
        const body = {
          itemId,
          itemUnitId,
          qty: 1,
          note: '',
          modifiers: [] as number[],
          // No variants from the grid (they require user selection)
        };
        return this.productSvc.addItemToCart(body);
      })
    ).subscribe({
      next: () => {
        Swal.fire({
          toast: true,
          icon: 'success',
          title: 'Added to cart',
          position: 'top-end',
          showConfirmButton: false,
          timer: 1400,
          timerProgressBar: true,
        });
        // open the side cart (Cart component listens to this)
        window.dispatchEvent(new CustomEvent('cart:open'));
      },
      error: (err) => {
        console.error('Add to cart failed', err);
        Swal.fire({ icon: 'error', title: 'Oops', text: 'Could not add to cart.' });
      }
    });
  }

  toggleWishlist(product: any, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    product.isWished = !product.isWished;
  }

  toggleSection(section: 'filter' | 'sort') {
    if (section === 'filter') this.showFilter = !this.showFilter;
    else this.showSort = !this.showSort;
  }

  getSectionStyle(expanded: boolean, element: HTMLElement | null): any {
    if (!element) return {};
    const height = element.scrollHeight;
    return {
      height: expanded ? height + 'px' : '0px',
      opacity: expanded ? 1 : 0,
      overflow: 'hidden',
      transition: 'height 0.4s ease, opacity 0.3s ease'
    };
  }


  bookNow(product: any, event?: Event){
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
  this.router.navigate(['/booking'], {
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
}
