import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Services
import { 
  CustomerInvoiceService, 
  CustomerInvoice, 
  InvoiceLine, 
  InvoicePayment,
  StatusInfo 
} from '../../services/customer-invoice';

// SweetAlert2
import Swal from 'sweetalert2';

@Component({
  selector: 'app-customer-invoices',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    // Material
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatBadgeModule,
    MatTooltipModule,
    MatExpansionModule,
    MatTabsModule,
    MatRippleModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './customer-invoices.html',
  styleUrl: './customer-invoices.scss'
})
export class CustomerInvoices implements OnInit {
  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCY INJECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly invoiceService = inject(CustomerInvoiceService);
  private readonly snackBar = inject(MatSnackBar);

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNALS FROM SERVICE
  // ═══════════════════════════════════════════════════════════════════════════

  readonly invoices = this.invoiceService.sortedInvoices;
  readonly loading = this.invoiceService.loading;
  readonly error = this.invoiceService.error;
  readonly selectedInvoice = this.invoiceService.selectedInvoice;
  readonly filterStatus = this.invoiceService.filterStatus;
  readonly stats = this.invoiceService.invoiceStats;

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly expandedInvoiceId = signal<number | null>(null);
  readonly showFilters = signal<boolean>(true);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════

  readonly allStatuses = computed(() => this.invoiceService.getAllStatuses());

  readonly hasInvoices = computed(() => this.invoices().length > 0);

  readonly activeFilterLabel = computed(() => {
    const status = this.filterStatus();
    if (status === null) return 'All Orders';
    return this.invoiceService.getStatusInfo(status).labelEN;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadInvoices();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  loadInvoices(): void {
    this.invoiceService.loadInvoices().subscribe({
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Failed to load orders',
          text: err?.message || 'Please try again later'
        });
      }
    });
  }

  refreshInvoices(): void {
    this.invoiceService.refreshInvoices().subscribe({
      next: () => {
        this.snackBar.open('Orders refreshed successfully', 'Close', {
          duration: 2000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      },
      error: (err) => {
        this.snackBar.open('Failed to refresh orders', 'Close', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  setFilter(status: number | null): void {
    this.invoiceService.setFilterStatus(status);
  }

  clearFilters(): void {
    this.invoiceService.clearFilters();
  }

  isFilterActive(status: number | null): boolean {
    return this.filterStatus() === status;
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  toggleViewMode(): void {
    this.viewMode.update(mode => mode === 'grid' ? 'list' : 'grid');
  }

  expandInvoice(invoiceId: number): void {
    this.expandedInvoiceId.update(id => id === invoiceId ? null : invoiceId);
  }

  isExpanded(invoiceId: number): boolean {
    return this.expandedInvoiceId() === invoiceId;
  }

  viewInvoiceDetails(invoice: CustomerInvoice): void {
    this.invoiceService.selectInvoice(invoice);
  }

  closeDetails(): void {
    this.invoiceService.selectInvoice(null);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  getStatusInfo(statusId: number): StatusInfo {
    return this.invoiceService.getStatusInfo(statusId);
  }

  formatDate(dateString: string, locale: 'en' | 'ar' = 'en'): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }


  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  isInvoicePaid(invoice: CustomerInvoice): boolean {
    return this.invoiceService.isInvoicePaid(invoice);
  }

  getTotalPaidAmount(invoice: CustomerInvoice): number {
    return this.invoiceService.getTotalPaidAmount(invoice);
  }

  getRemainingAmount(invoice: CustomerInvoice): number {
    return this.invoiceService.getRemainingAmount(invoice);
  }

  getTotalItems(invoice: CustomerInvoice): number {
    return this.invoiceService.getTotalItems(invoice);
  }

  getPaymentStatusClass(invoice: CustomerInvoice): string {
    if (this.isInvoicePaid(invoice)) {
      const remaining = this.getRemainingAmount(invoice);
      if (remaining <= 0) return 'fully-paid';
      return 'partially-paid';
    }
    return 'unpaid';
  }

  getPaymentStatusLabel(invoice: CustomerInvoice): string {
    if (!this.isInvoicePaid(invoice)) return 'Unpaid';
    const remaining = this.getRemainingAmount(invoice);
    if (remaining <= 0) return 'Paid';
    return 'Partial';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK BY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  trackByInvoice(index: number, invoice: CustomerInvoice): number {
    return invoice.invoiceHeaderId;
  }

  trackByLine(index: number, line: InvoiceLine): string {
    return `${line.itemEnglishName}-${line.uniEnglishName}-${index}`;
  }

  trackByPayment(index: number, payment: InvoicePayment): number {
    return payment.paymentTypeId;
  }

  trackByStatus(index: number, status: StatusInfo): number {
    return status.id;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS COUNT FOR BADGES
  // ═══════════════════════════════════════════════════════════════════════════

  getStatusCount(statusId: number): number {
    const stats = this.stats();
    switch (statusId) {
      case 0: return stats.pending;
      case 1: return stats.ready;
      case 2: return stats.withDriver;
      case 3: return stats.completed;
      case 4: return stats.inWorkshop;
      case 5: return stats.inShop;
      case 6: return stats.inStore;
      default: return 0;
    }
  }
}