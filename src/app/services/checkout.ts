import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface OrderType {
  id: number;
  type: string | null;
  arabicName: string;
  englishName: string;
  image: string;
}

export interface PaymentMethod {
  id: number;
  code: string;
  nameEN: string;
  nameAR: string;
}

export interface SubmitCartRequest {
  orderTypeId: number;
  paymentMethod: number;
  customerAddressId: number;
}

export interface SubmitCartResponse {
  status: boolean;
  data: any;
  msgEN?: string | null;
  msgAR?: string | null;
}

export interface ConfigDataResponse {
  status: boolean;
  data: {
    orderTypes: OrderType[];
    [key: string]: any;
  };
}

export interface CheckoutState {
  orderTypeId: number | null;
  paymentMethod: number;
  customerAddressId: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // ─────────────────────────────────────────────────────────────────────────
  // State Management with Signals
  // ─────────────────────────────────────────────────────────────────────────
  
  private readonly _orderTypes = signal<OrderType[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _submitting = signal<boolean>(false);

  // Checkout state
  private readonly _checkoutState = signal<CheckoutState>({
    orderTypeId: null,
    paymentMethod: 0, // Default: COD
    customerAddressId: null
  });

  // Public readonly signals
  readonly orderTypes = this._orderTypes.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly submitting = this._submitting.asReadonly();
  readonly checkoutState = this._checkoutState.asReadonly();

  // Computed signals
  readonly filteredOrderTypes = computed(() => 
    this._orderTypes().filter(ot => ot.id === 1 || ot.id === 2)
  );

  readonly isDelivery = computed(() => 
    this._checkoutState().orderTypeId === 2
  );

  readonly isPickup = computed(() => 
    this._checkoutState().orderTypeId === 1
  );

  readonly canSubmit = computed(() => {
    const state = this._checkoutState();
    if (!state.orderTypeId) return false;
    if (state.orderTypeId === 2 && !state.customerAddressId) return false;
    return true;
  });

  // Payment methods (static)
  readonly paymentMethods: PaymentMethod[] = [
    { id: 0, code: 'COD', nameEN: 'Cash on Delivery', nameAR: 'الدفع عند الاستلام' },
    { id: 1, code: 'ONLINE', nameEN: 'Online Payment', nameAR: 'الدفع الإلكتروني' }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // API Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch order types from config API
   */
  loadOrderTypes(): Observable<OrderType[]> {
    this._loading.set(true);
    
    return this.http.get<ConfigDataResponse>(`${this.base}/api/GetConfigDataExternal`)
      .pipe(
        map(response => {
          if (response.status && response.data?.orderTypes) {
            // Filter only Pickup (1) and Delivery (2)
            const filtered = response.data.orderTypes.filter(
              (ot: OrderType) => ot.id === 1 || ot.id === 2
            );
            return filtered;
          }
          return [];
        }),
        tap({
          next: (types) => {
            this._orderTypes.set(types);
            this._loading.set(false);
          },
          error: () => {
            this._loading.set(false);
          }
        })
      );
  }

  /**
   * Submit the cart for checkout
   */
  submitCart(request: SubmitCartRequest): Observable<SubmitCartResponse> {
    this._submitting.set(true);
    
    return this.http.post<SubmitCartResponse>(
      `${this.base}/api/SubmitItemsCart`,
      request
    ).pipe(
      tap({
        next: () => this._submitting.set(false),
        error: () => this._submitting.set(false)
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Management Methods
  // ─────────────────────────────────────────────────────────────────────────

  setOrderType(orderTypeId: number): void {
    this._checkoutState.update(state => ({
      ...state,
      orderTypeId,
      // Reset address if switching to pickup
      customerAddressId: orderTypeId === 1 ? null : state.customerAddressId
    }));
  }

  setPaymentMethod(paymentMethod: number): void {
    this._checkoutState.update(state => ({
      ...state,
      paymentMethod
    }));
  }

  setCustomerAddress(customerAddressId: number | null): void {
    this._checkoutState.update(state => ({
      ...state,
      customerAddressId
    }));
  }

  /**
   * Build the request object for submission
   */
  buildSubmitRequest(): SubmitCartRequest {
    const state = this._checkoutState();
    return {
      orderTypeId: state.orderTypeId ?? 0,
      paymentMethod: state.paymentMethod,
      customerAddressId: state.customerAddressId ?? 0
    };
  }

  /**
   * Reset checkout state
   */
  resetState(): void {
    this._checkoutState.set({
      orderTypeId: null,
      paymentMethod: 0,
      customerAddressId: null
    });
  }

  /**
   * Get order type label by id
   */
  getOrderTypeLabel(id: number, lang: 'en' | 'ar' = 'en'): string {
    const orderType = this._orderTypes().find(ot => ot.id === id);
    if (!orderType) return '';
    return lang === 'ar' ? orderType.arabicName : orderType.englishName;
  }

  /**
   * Get payment method label by id
   */
  getPaymentMethodLabel(id: number, lang: 'en' | 'ar' = 'en'): string {
    const method = this.paymentMethods.find(pm => pm.id === id);
    if (!method) return '';
    return lang === 'ar' ? method.nameAR : method.nameEN;
  }
}