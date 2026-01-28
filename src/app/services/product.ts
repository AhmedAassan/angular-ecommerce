// src/app/services/product.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, take, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

type SortDir = 'asc' | 'desc';

export interface GetProductsBody {
  name?: string;
  categoryName?: string;
  categoryId?: number;
  itemType?: number;
  itemCode?: string;
  isActive?: number;
  itemModifiers?: number[];
  itemDefaultLocations?: number[];
  barcode?: string;
  consignmentId?: number;
  brandId?: number;
  serialNo?: string;
  size?: string;
  color?: string;
  description?: string;
}

export interface GetProductsOptions {
  limit?: number;
  skip?: number;
  orderBy?: string;
  direction?: SortDir;
}

export interface ProductsPagedResponse {
  items: any[];
  total: number;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
}

export type AddItemCartBody = {
  itemId: number;
  itemUnitId: number;
  variantAttributeValueId1?: number;
  variantAttributeValueId2?: number;
  variantAttributeValueId3?: number;
  variantAttributeValueId4?: number;
  variantAttributeValueId5?: number;
  variantAttributeValueId6?: number;
  qty: number;
  note?: string;
  modifiers: number[];
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly base = environment.apiBase;
  private readonly imageBase = environment.imageBase;

  private readonly cartQtySubj = new BehaviorSubject<number>(0);
  readonly cartQty$ = this.cartQtySubj.asObservable();

  private extractCartRows = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.records)) return res.records;
    return [];
  };

  private pushCartQty(rows: any[]) {
    const qty = (rows ?? []).reduce((s, r) => s + (Number(r?.qty) || 0), 0);
    this.cartQtySubj.next(qty);
  }

  refreshCartQty(): void {
    this.getCart().pipe(take(1)).subscribe({
      next: () => {},
      error: () => this.cartQtySubj.next(0)
    });
  }

  private readonly imageBaseWithSlash =
    (this.imageBase || '').endsWith('/') ? (this.imageBase || '') : `${this.imageBase || ''}/`;

  constructor(private http: HttpClient) {}

  buildImageUrl(documentName?: string | null): string {
    if (documentName && documentName.trim().length) {
      return `${this.imageBaseWithSlash}${documentName}`;
    }
    return 'assets/images/placeholder.jpg';
  }

  private normalizeItem = <T extends { documentName?: string | null }>(p: T) => ({
    ...p,
    fullImageUrl: this.buildImageUrl(p?.documentName ?? null),
  });

  /**
   * Extract items array from API response
   */
  private extractItems(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.products)) return res.products;
    if (Array.isArray(res?.list)) return res.list;
    if (Array.isArray(res?.result)) return res.result;
    if (Array.isArray(res?.records)) return res.records;
    if (res?.succeeded && Array.isArray(res?.data)) return res.data;
    return [];
  }

  /**
   * Build query params for pagination
   * Uses 'limit' and 'skip' as query parameters
   */
  private buildPaginationParams(limit: number, skip: number): HttpParams {
    return new HttpParams()
      .set('limit', String(limit))
      .set('skip', String(skip));
  }

  /**
   * Get products with pagination - returns items + metadata
   * 
   * @param body - Filter body (categoryId, name, etc.)
   * @param limit - Number of items to fetch
   * @param skip - Number of items to skip
   */
  getProductsPaginated(
    body: GetProductsBody = {},
    limit: number = 30,
    skip: number = 0
  ): Observable<ProductsPagedResponse> {
    const params = this.buildPaginationParams(limit, skip);

    console.log(`[ProductService] Fetching products - limit: ${limit}, skip: ${skip}`, body);

    return this.http
      .post<any>(`${this.base}/api/GetProducts`, body, { params })
      .pipe(
        map(res => {
          console.log('[ProductService] API Response:', res);
          
          const items = this.extractItems(res).map(this.normalizeItem);
          const total = res?.count ?? res?.totalCount ?? res?.total ?? items.length;
          const currentPage = res?.currentPage ?? Math.floor(skip / limit);
          const pageSize = res?.pageSize ?? limit;
          
          // Determine if there are more items
          // If API returned less items than requested, there are no more
          const hasMore = items.length === limit && (skip + items.length) < total;

          console.log(`[ProductService] Extracted ${items.length} items. Total: ${total}, HasMore: ${hasMore}`);

          return {
            items,
            total,
            hasMore,
            currentPage,
            pageSize
          };
        }),
        catchError(err => {
          console.error('[ProductService] Error fetching products:', err);
          return of({ items: [], total: 0, hasMore: false, currentPage: 0, pageSize: limit });
        })
      );
  }

  /**
   * Get all products (backward compatible - no pagination)
   */
  getAllProducts(opts: GetProductsOptions = {}): Observable<any[]> {
    const params = this.buildPaginationParams(opts.limit ?? 1000, opts.skip ?? 0);
    
    return this.http
      .post<any>(`${this.base}/api/GetProducts`, {}, { params })
      .pipe(
        map(res => this.extractItems(res)),
        map(list => list.map(this.normalizeItem)),
        catchError(err => {
          console.error('[ProductService] Error in getAllProducts:', err);
          return of([]);
        })
      );
  }

  /**
   * Get products by category ID
   */
  getProductsByCategoryId(categoryId: number, opts: GetProductsOptions = {}): Observable<any[]> {
    const params = this.buildPaginationParams(opts.limit ?? 1000, opts.skip ?? 0);

    return this.http
      .post<any>(`${this.base}/api/GetProducts`, { categoryId }, { params })
      .pipe(
        map(res => this.extractItems(res)),
        map(list => list.map(this.normalizeItem)),
        catchError(err => {
          console.error('[ProductService] Error in getProductsByCategoryId:', err);
          return of([]);
        })
      );
  }

  /**
   * Get products by category name
   */
  getProductsByCategoryName(categoryName: string, opts: GetProductsOptions = {}): Observable<any[]> {
    const params = this.buildPaginationParams(opts.limit ?? 1000, opts.skip ?? 0);

    return this.http
      .post<any>(`${this.base}/api/GetProducts`, { categoryName }, { params })
      .pipe(
        map(res => this.extractItems(res)),
        map(list => list.map(this.normalizeItem)),
        catchError(err => {
          console.error('[ProductService] Error in getProductsByCategoryName:', err);
          return of([]);
        })
      );
  }

  /**
   * Search products
   */
  searchProducts(term: string, opts: GetProductsOptions = {}): Observable<any[]> {
    const q = term?.trim() ?? '';
    const params = this.buildPaginationParams(opts.limit ?? 10, opts.skip ?? 0);

    return this.http
      .post<any>(`${this.base}/api/GetProducts`, { name: q }, { params })
      .pipe(
        map(res => this.extractItems(res)),
        map(list => list.map(this.normalizeItem)),
        catchError(err => {
          console.error('[ProductService] Error in searchProducts:', err);
          return of([]);
        })
      );
  }

  /**
   * Get single product by ID
   */
  getProductById(itemId: number): Observable<any> {
    const params = new HttpParams().set('ItemId', String(itemId));
    return this.http
      .get<any>(`${this.base}/api/GetProductById`, { params })
      .pipe(
        map(prod => this.normalizeItem(prod)),
        catchError(err => {
          console.error('[ProductService] Error in getProductById:', err);
          return of(null);
        })
      );
  }

  /**
   * Generic get products with filters
   */
  getProducts(body: GetProductsBody = {}, opts: GetProductsOptions = {}): Observable<any[]> {
    const params = this.buildPaginationParams(opts.limit ?? 1000, opts.skip ?? 0);

    return this.http
      .post<any>(`${this.base}/api/GetProducts`, body, { params })
      .pipe(
        map(res => this.extractItems(res)),
        map(list => list.map(this.normalizeItem)),
        catchError(err => {
          console.error('[ProductService] Error in getProducts:', err);
          return of([]);
        })
      );
  }

  /* ============ CART API ============ */

  addItemToCart(body: AddItemCartBody): Observable<any> {
    return this.http.post<any>(`${this.base}/api/AddItemCart`, body)
      .pipe(tap(() => this.refreshCartQty()));
  }

  updateCartItem(id: number, qty: number): Observable<any> {
    const params = new HttpParams().set('Id', String(id)).set('Qty', String(qty));
    return this.http.post<any>(`${this.base}/api/UpdateItemCart`, null, { params })
      .pipe(tap(() => this.refreshCartQty()));
  }

  deleteCartItem(id: number): Observable<any> {
    const params = new HttpParams().set('Id', String(id));
    return this.http.post<any>(`${this.base}/api/DeleteItemCart`, null, { params })
      .pipe(tap(() => this.refreshCartQty()));
  }

  clearCart(): Observable<any> {
    return this.http.post<any>(`${this.base}/api/DeleteAllItemCart`, null)
      .pipe(tap(() => this.refreshCartQty()));
  }

  getCart(): Observable<any[]> {
    return this.http.get<any>(`${this.base}/api/GetItemsCart`).pipe(
      map(res => this.extractCartRows(res)),
      tap(rows => this.pushCartQty(rows))
    );
  }
}