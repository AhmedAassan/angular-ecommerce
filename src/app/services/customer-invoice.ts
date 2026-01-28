import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface InvoiceLine {
  itemArabicName: string;
  itemEnglishName: string;
  unitArabicName: string;
  uniEnglishName: string;
  qty: number;
  price: number;
  totalPrice: number;
  discountPrecent: number;
  disconutValue: number;
  net: number;
}

export interface InvoicePayment {
  paymentTypeId: number;
  paymentTypeArabicName: string;
  paymentTypeEnglishName: string;
  amount: number;
  notes: string | null;
}

export interface CustomerInvoice {
  invoiceHeaderId: number;
  invoiceCode: string;
  invoiceDate: string;
  statusId: number;
  totalPrice: number;
  discountPrecent: number;
  disconutValue: number;
  net: number;
  customerAddressId: number | null;
  deliveryCharge: number | null;
  deliveryDate: string | null;
  driverId: number | null;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

export interface InvoiceApiResponse {
  status: boolean;
  data: CustomerInvoice[];
  msgEN: string;
  msgAR: string;
}

// Status enum for type safety
export enum InvoiceStatus {
  Pending = 0,
  Ready = 1,
  WithDriver = 2,
  Completed = 3,
  InWorkshop = 4,
  InShop = 5,
  InStore = 6
}

export interface StatusInfo {
  id: number;
  labelEN: string;
  labelAR: string;
  color: string;
  icon: string;
  bgColor: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class CustomerInvoiceService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // ─────────────────────────────────────────────────────────────────────────
  // State Management with Signals
  // ─────────────────────────────────────────────────────────────────────────

  private readonly _invoices = signal<CustomerInvoice[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedInvoice = signal<CustomerInvoice | null>(null);
  private readonly _filterStatus = signal<number | null>(null);

  // Public readonly signals
  readonly invoices = this._invoices.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedInvoice = this._selectedInvoice.asReadonly();
  readonly filterStatus = this._filterStatus.asReadonly();

  // ─────────────────────────────────────────────────────────────────────────
  // Status Configuration
  // ─────────────────────────────────────────────────────────────────────────

  readonly statusMap: Map<number, StatusInfo> = new Map([
    [0, { 
      id: 0, 
      labelEN: 'Pending', 
      labelAR: 'قيد الانتظار', 
      color: '#FF9800', 
      icon: 'hourglass_empty',
      bgColor: 'rgba(255, 152, 0, 0.1)'
    }],
    [1, { 
      id: 1, 
      labelEN: 'Ready', 
      labelAR: 'جاهز', 
      color: '#4CAF50', 
      icon: 'check_circle',
      bgColor: 'rgba(76, 175, 80, 0.1)'
    }],
    [2, { 
      id: 2, 
      labelEN: 'With Driver', 
      labelAR: 'مع السائق', 
      color: '#2196F3', 
      icon: 'local_shipping',
      bgColor: 'rgba(33, 150, 243, 0.1)'
    }],
    [3, { 
      id: 3, 
      labelEN: 'Completed', 
      labelAR: 'مكتمل', 
      color: '#8BC34A', 
      icon: 'done_all',
      bgColor: 'rgba(139, 195, 74, 0.1)'
    }],
    [4, { 
      id: 4, 
      labelEN: 'In Workshop', 
      labelAR: 'في الورشة', 
      color: '#9C27B0', 
      icon: 'precision_manufacturing',
      bgColor: 'rgba(156, 39, 176, 0.1)'
    }],
    [5, { 
      id: 5, 
      labelEN: 'In Shop', 
      labelAR: 'في المحل', 
      color: '#00BCD4', 
      icon: 'store',
      bgColor: 'rgba(0, 188, 212, 0.1)'
    }],
    [6, { 
      id: 6, 
      labelEN: 'In Store', 
      labelAR: 'في المخزن', 
      color: '#607D8B', 
      icon: 'warehouse',
      bgColor: 'rgba(96, 125, 139, 0.1)'
    }]
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Signals
  // ─────────────────────────────────────────────────────────────────────────

  readonly filteredInvoices = computed(() => {
    const status = this._filterStatus();
    const invoices = this._invoices();
    
    if (status === null) return invoices;
    return invoices.filter(inv => inv.statusId === status);
  });

  readonly invoiceStats = computed(() => {
    const invoices = this._invoices();
    
    const stats = {
      total: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.net, 0),
      pending: invoices.filter(inv => inv.statusId === 0).length,
      ready: invoices.filter(inv => inv.statusId === 1).length,
      withDriver: invoices.filter(inv => inv.statusId === 2).length,
      completed: invoices.filter(inv => inv.statusId === 3).length,
      inWorkshop: invoices.filter(inv => inv.statusId === 4).length,
      inShop: invoices.filter(inv => inv.statusId === 5).length,
      inStore: invoices.filter(inv => inv.statusId === 6).length,
      paid: invoices.filter(inv => inv.payments.length > 0).length,
      unpaid: invoices.filter(inv => inv.payments.length === 0).length
    };
    
    return stats;
  });

  readonly sortedInvoices = computed(() => {
    return [...this.filteredInvoices()].sort((a, b) => {
      return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // API Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch all customer invoices
   */
  loadInvoices(): Observable<CustomerInvoice[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<InvoiceApiResponse>(`${this.base}/api/GetCustomerInvoices`)
      .pipe(
        map(response => {
          if (response.status && response.data) {
            return response.data;
          }
          throw new Error(response.msgEN || 'Failed to load invoices');
        }),
        tap({
          next: (invoices) => {
            this._invoices.set(invoices);
            this._loading.set(false);
          },
          error: (err) => {
            this._error.set(err.message || 'Failed to load invoices');
            this._loading.set(false);
          }
        })
      );
  }

  /**
   * Refresh invoices (force reload)
   */
  refreshInvoices(): Observable<CustomerInvoice[]> {
    return this.loadInvoices();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Management Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Select an invoice for detail view
   */
  selectInvoice(invoice: CustomerInvoice | null): void {
    this._selectedInvoice.set(invoice);
  }

  /**
   * Select invoice by ID
   */
  selectInvoiceById(invoiceId: number): void {
    const invoice = this._invoices().find(inv => inv.invoiceHeaderId === invoiceId);
    this._selectedInvoice.set(invoice ?? null);
  }

  /**
   * Set filter status
   */
  setFilterStatus(status: number | null): void {
    this._filterStatus.set(status);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this._filterStatus.set(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get status info by ID
   */
  getStatusInfo(statusId: number): StatusInfo {
    return this.statusMap.get(statusId) ?? {
      id: statusId,
      labelEN: 'Unknown',
      labelAR: 'غير معروف',
      color: '#9E9E9E',
      icon: 'help',
      bgColor: 'rgba(158, 158, 158, 0.1)'
    };
  }

  /**
   * Get all available statuses for filter
   */
  getAllStatuses(): StatusInfo[] {
    return Array.from(this.statusMap.values());
  }

  /**
   * Check if invoice is paid
   */
  isInvoicePaid(invoice: CustomerInvoice): boolean {
    return invoice.payments.length > 0;
  }

  /**
   * Get total paid amount for invoice
   */
  getTotalPaidAmount(invoice: CustomerInvoice): number {
    return invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  /**
   * Get remaining amount to pay
   */
  getRemainingAmount(invoice: CustomerInvoice): number {
    const paid = this.getTotalPaidAmount(invoice);
    return Math.max(0, invoice.net - paid);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string, locale: 'en' | 'ar' = 'en'): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string = 'KWD'): string {
    return new Intl.NumberFormat('en-KW', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Get invoice by ID
   */
  getInvoiceById(invoiceId: number): CustomerInvoice | undefined {
    return this._invoices().find(inv => inv.invoiceHeaderId === invoiceId);
  }

  /**
   * Calculate total items in invoice
   */
  getTotalItems(invoice: CustomerInvoice): number {
    return invoice.lines.reduce((sum, line) => sum + line.qty, 0);
  }
}