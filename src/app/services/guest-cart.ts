// src/app/services/guest-cart.service.ts
import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface GuestCartItem {
  // Unique key for the cart row (generated locally)
  localId: string;
  
  // Product info
  itemId: number;
  itemUnitId: number;
  qty: number;
  note?: string;
  modifiers: number[];
  
  // Variant info (optional)
  variantAttributeValueId1?: number;
  variantAttributeValueId2?: number;
  variantAttributeValueId3?: number;
  variantAttributeValueId4?: number;
  variantAttributeValueId5?: number;
  variantAttributeValueId6?: number;
  
  // Display info (cached from product)
  itemEnglishName?: string;
  itemArabicName?: string;
  unitEnglishName?: string;
  unitArabicName?: string;
  price?: number;
  documentName?: string;
  imageUrl?: string;
  variantEnglishName?: string;
  variantArabicName?: string;
  
  // Timestamps
  addedAt: number;
}

const STORAGE_KEY = 'guest_cart';

@Injectable({ providedIn: 'root' })
export class GuestCartService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ========== Reactive State (Angular Signals) ==========
  private readonly itemsSignal = signal<GuestCartItem[]>([]);
  
  /** Reactive read-only items */
  readonly items = this.itemsSignal.asReadonly();
  
  /** Reactive cart quantity */
  readonly cartQty = computed(() => 
    this.itemsSignal().reduce((sum, item) => sum + item.qty, 0)
  );
  
  /** Reactive cart count (number of unique items) */
  readonly cartCount = computed(() => this.itemsSignal().length);

  constructor() {
    // Load from storage only in browser
    if (this.isBrowser) {
      const loaded = this.loadFromStorage();
      this.itemsSignal.set(loaded);
    }
  }

  // ========== Storage Operations ==========
  
  private loadFromStorage(): GuestCartItem[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }
      
      const parsed = JSON.parse(data);
      
      // Validate it's an array
      if (!Array.isArray(parsed)) {
        console.warn('Guest cart data is not an array, resetting');
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      
      // Filter out any invalid items
      const validItems = parsed.filter((item: any) => 
        item && 
        typeof item.itemId === 'number' && 
        typeof item.itemUnitId === 'number' &&
        typeof item.qty === 'number' &&
        item.localId
      );

      if (validItems.length !== parsed.length) {
        console.warn(`Filtered out ${parsed.length - validItems.length} invalid cart items`);
        this.saveToStorage(validItems);
      }

      return validItems;
    } catch (e) {
      console.warn('Failed to parse guest cart from storage, resetting', e);
      // Clear corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      return [];
    }
  }

  private saveToStorage(items: GuestCartItem[]): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      if (items.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch (e) {
      console.error('Failed to save guest cart to storage', e);
    }
  }

  private updateItems(items: GuestCartItem[]): void {
    this.itemsSignal.set(items);
    this.saveToStorage(items);
  }

  // ========== Cart Operations ==========

  /** Generate unique key for cart item (considers variants) */
  private generateItemKey(item: Partial<GuestCartItem>): string {
    const parts = [
      item.itemId,
      item.itemUnitId,
      item.variantAttributeValueId1 ?? 0,
      item.variantAttributeValueId2 ?? 0,
      item.variantAttributeValueId3 ?? 0,
      item.variantAttributeValueId4 ?? 0,
      item.variantAttributeValueId5 ?? 0,
      item.variantAttributeValueId6 ?? 0,
      (item.modifiers ?? []).sort().join('-')
    ];
    return parts.join('_');
  }

  /** Generate a UUID (with fallback for older browsers) */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /** Find existing item with same product+variant+modifiers */
  private findExisting(item: Partial<GuestCartItem>): GuestCartItem | undefined {
    const key = this.generateItemKey(item);
    return this.itemsSignal().find(i => this.generateItemKey(i) === key);
  }

  /** Add item to cart (or increment qty if exists) */
  addItem(item: Omit<GuestCartItem, 'localId' | 'addedAt'>): GuestCartItem {
    const items = [...this.itemsSignal()];
    const existing = this.findExisting(item);

    if (existing) {
      // Update quantity
      const idx = items.findIndex(i => i.localId === existing.localId);
      items[idx] = {
        ...existing,
        qty: existing.qty + item.qty,
        // Update display info if provided
        ...(item.price !== undefined && { price: item.price }),
        ...(item.imageUrl && { imageUrl: item.imageUrl }),
        ...(item.documentName && { documentName: item.documentName }),
        ...(item.itemEnglishName && { itemEnglishName: item.itemEnglishName }),
        ...(item.itemArabicName && { itemArabicName: item.itemArabicName }),
      };
      this.updateItems(items);
      return items[idx];
    }

    // Add new item
    const newItem: GuestCartItem = {
      ...item,
      localId: this.generateUUID(),
      addedAt: Date.now(),
    };
    this.updateItems([...items, newItem]);
    return newItem;
  }

  /** Update item quantity */
  updateQty(localId: string, qty: number): boolean {
    if (qty < 1) return false;
    
    const items = this.itemsSignal();
    const idx = items.findIndex(i => i.localId === localId);
    
    if (idx === -1) return false;

    const updated = [...items];
    updated[idx] = { ...updated[idx], qty };
    this.updateItems(updated);
    return true;
  }

  /** Remove item from cart */
  removeItem(localId: string): boolean {
    const items = this.itemsSignal();
    const filtered = items.filter(i => i.localId !== localId);
    
    if (filtered.length === items.length) return false;
    
    this.updateItems(filtered);
    return true;
  }

  /** Clear entire cart */
  clearCart(): void {
    this.updateItems([]);
  }

  /** Get all items (snapshot) */
  getItems(): GuestCartItem[] {
    return [...this.itemsSignal()];
  }

  /** Check if cart is empty */
  isEmpty(): boolean {
    return this.itemsSignal().length === 0;
  }

  /** Get cart for sync (used when logging in) */
  getItemsForSync(): Array<{
    itemId: number;
    itemUnitId: number;
    qty: number;
    note?: string;
    modifiers: number[];
    variantAttributeValueId1?: number;
    variantAttributeValueId2?: number;
    variantAttributeValueId3?: number;
    variantAttributeValueId4?: number;
    variantAttributeValueId5?: number;
    variantAttributeValueId6?: number;
  }> {
    return this.itemsSignal().map(item => ({
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
    }));
  }

  /** Debug: Log current state */
  debug(): void {
    console.log('Guest Cart State:', {
      items: this.itemsSignal(),
      count: this.cartCount(),
      qty: this.cartQty(),
      isEmpty: this.isEmpty(),
    });
  }
}