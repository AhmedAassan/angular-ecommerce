// src/app/pages/booking-product-category/booking-product-category.ts
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { switchMap } from 'rxjs/operators';

import {
  BookingCategoryService,
  Branch,
  Staff,
  AppointmentCategory,
  ServiceItem,
  CategoryConfigData,
  SubmitCategoryBookingBody
} from '../../services/booking-category';

import { CartManagerService } from '../../services/cart-manager';
import { ProductService } from '../../services/product';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type PageView = 'products' | 'booking';

interface BookingFormState {
  date: string;
  time: string;
  staffId: number | null;
  serviceType: 0 | 1;
  persons: number;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-booking-product-category',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './booking-product-category.html',
  styleUrl: './booking-product-category.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingProductCategory implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bookingService = inject(BookingCategoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly cartManager = inject(CartManagerService);
  private readonly productService = inject(ProductService);

  readonly ITEM_TYPE_BOOKING = 2;
  itemsDropdownOpen = signal(false);

  selectedItems = computed(() =>
    this.itemsByStaff().filter(it => this.selectedItemIds().includes(it.id))
  );

  selectedItemsPreview = computed(() => {
    const items = this.selectedItems();
    if (items.length === 0) return '';

    const firstThree = items
      .slice(0, 3)
      .map(i => i.englishName.trim())
      .filter(Boolean);

    const moreCount = items.length - firstThree.length;
    return moreCount > 0
      ? `${firstThree.join(', ')} +${moreCount}`
      : firstThree.join(', ');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────

  currentView = signal<PageView>('products');

  // Loading States
  isLoading = signal(true);
  isLoadingStaff = signal(false);
  isSubmitting = signal(false);

  // Route Params
  categoryId = signal<number>(0);
  branchId = signal<number>(0);

  // Config Data
  config = signal<CategoryConfigData | null>(null);
  category = signal<AppointmentCategory | null>(null);
  branch = signal<Branch | null>(null);

  services = signal<(ServiceItem & { isAddingToCart?: boolean; justAdded?: boolean })[]>([]);
  staffList = signal<Staff[]>([]);

  // Selected Service (old flow)
  selectedService = signal<ServiceItem | null>(null);

  // Base URLs
  categoryImageBase = signal('');
  staffImageBase = signal('');
  productImageBase = signal('');
  currency = signal('KWD');

  showPaymentTermsSheet = signal(false);
  paymentTermsAccepted = signal(false);
  pendingSubmitAfterTerms = signal(false);

  paymentTermsText = computed(() => (this.config()?.business_info?.paymentTerms || '').trim());
  hasPaymentTerms = computed(() => this.paymentTermsText().length > 0);

  // Payment Settings
  depositAmount = computed(() => this.category()?.deposit ?? 0);
  isDeposit = computed(() => (this.category()?.deposit ?? 0) !== 0);

  // UI States
  staffDropdownOpen = signal(false);

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT SUCCESS STATE
  // ─────────────────────────────────────────────────────────────────────────
  
  showPaymentSuccess = signal(false);
  paymentUrl = signal('');
  paymentMessage = signal('');

  // Form State
  form = signal<BookingFormState>({
    date: '',
    time: '',
    staffId: null,
    serviceType: 0,
    persons: 1,
    notes: ''
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MAKEUP FLOW STATE (NOW SHARED WITH OLD FLOW FOR TIME SLOTS)
  // ─────────────────────────────────────────────────────────────────────────

  makeupMode = signal(false);
  preSelectedStaff = signal<Staff | null>(null);

  itemsByStaff = signal<ServiceItem[]>([]);
  selectedItemIds = signal<number[]>([]);
  
  // TIME SLOTS - Now used by both flows
  timeSlots = signal<string[]>([]);
  selectedTimeSlot = signal<string>('');
  showTimeSlotModal = signal(false);

  isLoadingItems = signal(false);
  isLoadingSlots = signal(false);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────

  selectedStaff = computed(() =>
    this.staffList().find(s => s.id === this.form().staffId) || null
  );

  effectiveStaff = computed(() => this.preSelectedStaff() || this.selectedStaff());

  isMakeupCategory = computed(() => {
    const cat = this.category();
    return !!cat?.isMakeup;
  });

  // Check if time slot can be selected (for old flow)
  canSelectTimeSlot = computed(() => {
    if (this.makeupMode() && this.isMakeupCategory()) {
      // Makeup flow: need date and items
      return !!this.form().date && this.selectedItemIds().length > 0;
    }
    // Old flow: need date, staff, and service
    return !!this.form().date && !!this.form().staffId && !!this.selectedService();
  });

  canSubmitBooking = computed(() => {
    const f = this.form();
    const category = this.category();
    const branch = this.branch();

    if (!category || !branch) return false;
    if (!f.date || !f.staffId) return false;
    if (f.persons < 1) return false;

    // Both flows now require selectedTimeSlot
    if (!this.selectedTimeSlot()) return false;

    // Makeup flow requirements
    if (this.makeupMode() && category.isMakeup) {
      if (this.selectedItemIds().length === 0) return false;
      return true;
    }

    // Old flow requirements
    const service = this.selectedService();
    if (!service) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.staff-dropdown-wrapper')) {
      this.staffDropdownOpen.set(false);
    }

    if (!target.closest('.items-dropdown-wrapper')) {
      this.itemsDropdownOpen.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────────────────────────────────

  private loadData(): void {
    const params = this.route.snapshot.params;
    this.categoryId.set(+params['categoryId'] || 0);
    this.branchId.set(+params['branchId'] || 0);

    const qp = this.route.snapshot.queryParamMap;
    this.makeupMode.set(qp.get('makeup') === '1');

    const qpStaffId = Number(qp.get('staffId') || 0);
    const qpDate = qp.get('date') || '';

    if (qpStaffId) this.updateForm({ staffId: qpStaffId });
    if (qpDate) this.updateForm({ date: qpDate });

    const nav = this.router.getCurrentNavigation();
    const stateStaff = (nav?.extras?.state as any)?.staff as Staff | undefined;
    this.preSelectedStaff.set(stateStaff ?? null);

    console.log('Route Params:', { categoryId: this.categoryId(), branchId: this.branchId() });
    console.log('Makeup Mode:', this.makeupMode(), { qpStaffId, qpDate, stateStaff });

    this.bookingService.getConfigData()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(err => {
          console.error('Error loading config:', err);
          return of(null);
        })
      )
      .subscribe({
        next: (cfg) => {
          if (!cfg) {
            this.isLoading.set(false);
            this.cdr.markForCheck();
            return;
          }

          this.config.set(cfg);
          this.setupConfig(cfg);

          const category = cfg.apointmentCategories?.find(c => c.id === this.categoryId());
          const branch = cfg.branches?.find(b => b.id === this.branchId());

          console.log('Found Category:', category);
          console.log('Found Branch:', branch);

          this.category.set(category || null);
          this.branch.set(branch || null);

          if (this.makeupMode() && category?.isMakeup) {
            this.currentView.set('booking');
            this.loadItemsByStaff();
            this.ensureMakeupStaffLoaded();
            this.isLoading.set(false);
            this.cdr.markForCheck();
          } else {
            this.loadServices();
          }
        },
        error: (err) => {
          console.error('Config subscription error:', err);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  private loadServices(): void {
    const categoryId = this.categoryId();
    const branchId = this.branchId();

    if (!categoryId || !branchId) {
      console.warn('Missing categoryId or branchId');
      this.isLoading.set(false);
      this.cdr.markForCheck();
      return;
    }

    console.log('Loading services for:', { branchId, categoryId });

    this.bookingService.getServicesByCategory(branchId, categoryId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }),
        catchError(err => {
          console.error('Error loading services:', err);
          return of([]);
        })
      )
      .subscribe({
        next: (services) => {
          console.log('Services loaded:', services);
          this.services.set(
            services.map(s => ({
              ...s,
              isAddingToCart: false,
              justAdded: false
            }))
          );
        },
        error: (err) => {
          console.error('Services subscription error:', err);
          this.services.set([]);
        }
      });
  }

  private setupConfig(cfg: CategoryConfigData): void {
    this.categoryImageBase.set(cfg.base_urls?.bookingCategory_image_url || '');
    this.staffImageBase.set(cfg.base_urls?.staff_image_url || '');
    this.productImageBase.set(cfg.base_urls?.product_image_url || '');
    this.currency.set(cfg.currency_symbol || 'KWD');
  }

  private ensureMakeupStaffLoaded(): void {
    if (this.preSelectedStaff()) return;

    const br = this.branch();
    const date = this.form().date;
    const staffId = this.form().staffId;

    if (!br || !date || !staffId) return;

    this.bookingService.getStaffAvailability(br.id, date)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.preSelectedStaff.set(list.find(x => x.id === staffId) || null);
        this.cdr.markForCheck();
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  updateForm(partial: Partial<BookingFormState>): void {
    this.form.update(f => ({ ...f, ...partial }));
  }

  resetForm(): void {
    this.form.set({
      date: '',
      time: '',
      staffId: null,
      serviceType: 0,
      persons: 1,
      notes: ''
    });
    // Reset time slots
    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');
  }

  weekDays = computed(() => {
    const base = this.form().date ? new Date(this.form().date) : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());

    return Array.from({ length: 8 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();

      return { iso, dayName, dayNum };
    });
  });

  openTimeSlotModal(): void {
    if (!this.canSelectTimeSlot()) return;

    this.showTimeSlotModal.set(true);

    if (this.timeSlots().length === 0 && !this.isLoadingSlots()) {
      this.loadTimeSlots();
    }
  }

  closeTimeSlotModal(): void {
    this.showTimeSlotModal.set(false);
  }

  selectDay(iso: string): void {
    this.updateForm({ date: iso });
    this.onDateChange();
  }

  confirmSlot(): void {
    if (!this.selectedTimeSlot()) return;
    this.closeTimeSlotModal();
  }

  formatSlotLabel(slot: string): string {
    const s = (slot || '').trim();

    const parts = s.split(' ').filter(Boolean);
    if (parts.length === 2 && (parts[0] === 'AM' || parts[0] === 'PM')) {
      return parts[1];
    }

    if (parts.length === 2 && (parts[1] === 'AM' || parts[1] === 'PM')) {
      return parts[0];
    }

    if (s.includes('-')) return s.split('-')[0].trim();

    return s;
  }

  getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  getServiceImage(service: ServiceItem): string {
    return this.bookingService.buildImageUrl(
      this.productImageBase(),
      (service as any).image ?? null,
      'assets/images/placeholder.jpg'
    );
  }

  getStaffImageUrl(staff: Staff): string {
    return this.bookingService.buildImageUrl(
      this.staffImageBase(),
      staff.image,
      'assets/images/staff-placeholder.jpg'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  goBackToCategories(): void {
    this.router.navigate(['/booking-category']);
  }

  goBackToProducts(): void {
    if (this.makeupMode() && this.isMakeupCategory()) {
      this.router.navigate(['/booking-category']);
      return;
    }

    this.currentView.set('products');
    this.selectedService.set(null);
    this.staffList.set([]);
    this.resetForm();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT SELECTION (OLD FLOW)
  // ─────────────────────────────────────────────────────────────────────────

  selectService(service: ServiceItem): void {
    if (service.itemType !== this.ITEM_TYPE_BOOKING) return;

    this.selectedService.set(service);
    this.currentView.set('booking');
    
    // Reset time slots when service changes
    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CART (itemType=1)
  // ─────────────────────────────────────────────────────────────────────────

  addToCart(service: any, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (service.itemType !== 1) return;

    const itemId = Number(service.id);
    if (!Number.isFinite(itemId)) {
      console.warn('[BPC] addToCart: missing itemId', service);
      return;
    }

    if (service.isAddingToCart) return;

    service.isAddingToCart = true;
    this.cdr.markForCheck();

    const resolveUnitId = (p: any): number | undefined =>
      Number(p?.itemUnitId) ||
      Number(p?.defaultItemUnitId) ||
      Number(p?.units?.[0]?.itemUnitId);

    const source$ = this.productService.getProductById(itemId);

    source$
      .pipe(
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
              itemEnglishName: p.englishName || service.englishName,
              itemArabicName: p.arabicName || service.arabicName,
              unitEnglishName: p.unitEnglishName || p.units?.[0]?.unitEnglishName,
              unitArabicName: p.unitArabicName || p.units?.[0]?.unitArabicName,
              price: p.price || p.salePrice || service.price,
              documentName: p.documentName,
              imageUrl: p.fullImageUrl || this.getServiceImage(service),
            }
          });
        }),
        finalize(() => {
          service.isAddingToCart = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (success) => {
          if (success) {
            service.justAdded = true;
            this.cdr.markForCheck();

            setTimeout(() => {
              service.justAdded = false;
              this.cdr.markForCheck();
            }, 2000);

            this.showToast('success', 'Added to cart');
            window.dispatchEvent(new CustomEvent('cart:open'));
          }
        },
        error: (err) => {
          console.error('[BPC] Add to cart failed', err);
          this.showAlert('error', 'Oops', err?.message || 'Could not add to cart.');
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOOKING FORM (OLD FLOW STAFF)
  // ─────────────────────────────────────────────────────────────────────────

  onDateChange(): void {
    // Reset time slots when date changes
    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');

    if (this.makeupMode() && this.isMakeupCategory()) {
      // Makeup flow: load time slots if items are selected
      if (this.selectedItemIds().length > 0) {
        this.loadTimeSlots();
      }
      return;
    }

    // Old flow: reset staff and load staff list
    this.updateForm({ staffId: null, time: '' });
    this.loadStaff();
  }

  private loadStaff(): void {
    const branch = this.branch();
    const date = this.form().date;

    if (!branch || !date) return;

    this.isLoadingStaff.set(true);
    this.staffList.set([]);

    this.bookingService.getStaffAvailability(branch.id, date)
      .pipe(
        finalize(() => {
          this.isLoadingStaff.set(false);
          this.cdr.markForCheck();
        }),
        catchError(err => {
          console.error('Error loading staff:', err);
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(staff => this.staffList.set(staff));
  }

  toggleStaffDropdown(): void {
    this.staffDropdownOpen.update(v => !v);
  }

  toggleItemsDropdown(): void {
    this.itemsDropdownOpen.update(v => !v);
  }

  clearSelectedItems(event?: Event): void {
    event?.stopPropagation();
    this.selectedItemIds.set([]);
    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');
  }

  toggleItemFromDropdown(itemId: number, event?: Event): void {
    event?.stopPropagation();
    this.toggleItemSelection(itemId);
  }

  selectStaff(staff: Staff): void {
    if (!staff.isAvailable) return;
    this.updateForm({ staffId: staff.id });
    this.staffDropdownOpen.set(false);

    // Reset and load time slots when staff changes (OLD FLOW)
    if (!(this.makeupMode() && this.isMakeupCategory())) {
      this.timeSlots.set([]);
      this.selectedTimeSlot.set('');
      
      // Load time slots if date and service are already selected
      if (this.form().date && this.selectedService()) {
        this.loadTimeSlots();
      }
    }
  }

  setServiceType(type: 0 | 1): void {
    this.updateForm({ serviceType: type });
  }

  adjustPersons(delta: number): void {
    const next = Math.max(1, this.form().persons + delta);
    this.updateForm({ persons: next });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAKEUP FLOW: ITEMS BY STAFF + TIME SLOTS
  // ─────────────────────────────────────────────────────────────────────────

  private loadItemsByStaff(): void {
    const catId = this.categoryId();
    const staffId = this.form().staffId;
    console.log('[Makeup] GetItemUnitsByStaff params =>', { catId, staffId });

    if (!catId || !staffId) {
      console.warn('[BPC] Makeup: missing catId/staffId', { catId, staffId });
      return;
    }

    this.isLoadingItems.set(true);
    this.itemsByStaff.set([]);
    this.selectedItemIds.set([]);
    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');

    this.bookingService.getItemsByStaff(catId, staffId)
      .pipe(
        finalize(() => {
          this.isLoadingItems.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
        catchError(err => {
          console.error('[BPC] getItemsByStaff error', err);
          return of([]);
        })
      )
      .subscribe(items => this.itemsByStaff.set(items));
  }

  toggleItemSelection(itemId: number): void {
    const current = this.selectedItemIds();
    const next = current.includes(itemId)
      ? current.filter(x => x !== itemId)
      : [...current, itemId];

    this.selectedItemIds.set(next);

    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');

    this.loadTimeSlots();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIME SLOTS - UNIFIED FOR BOTH FLOWS
  // ─────────────────────────────────────────────────────────────────────────

  private loadTimeSlots(): void {
    const staffId = this.form().staffId;
    const date = this.form().date;

    if (!staffId || !date) return;

    // Determine which item IDs to use
    let itemIds: number[] = [];

    if (this.makeupMode() && this.isMakeupCategory()) {
      // Makeup flow: use selected items
      itemIds = this.selectedItemIds();
    } else {
      // Old flow: use selected service
      const service = this.selectedService();
      if (service) {
        itemIds = [service.id];
      }
    }

    if (itemIds.length === 0) return;

    this.isLoadingSlots.set(true);
    this.timeSlots.set([]);
    this.selectedTimeSlot.set('');

    console.log('[loadTimeSlots]', { staffId, date, itemIds });

    this.bookingService.getAvailableTimeSlots(staffId, date, itemIds)
      .pipe(
        finalize(() => {
          this.isLoadingSlots.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
        catchError(err => {
          console.error('[BPC] getAvailableTimeSlots error', err);
          return of([]);
        })
      )
      .subscribe(slots => this.timeSlots.set(slots));
  }

  selectTimeSlot(slot: string): void {
    this.selectedTimeSlot.set(slot);
  }

  private buildMakeupReservationDateIso(date: string, slot: string): string {
    const start = (slot || '').split('-')[0]?.trim();
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = start.split(':').map(Number);

    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString();
  }

  private buildReservationDateIso(date: string, slot: string): string {
    // Extract time from slot (e.g., "09:00 - 10:00" or "09:00")
    const start = (slot || '').split('-')[0]?.trim();
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (start || '00:00').split(':').map(Number);

    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT BOOKING
  // ─────────────────────────────────────────────────────────────────────────

  submitBooking(skipTerms: boolean = false): void {
    const f = this.form();
    const category = this.category();
    const branch = this.branch();

    if (!category || !branch || !f.staffId) {
      this.showAlert('error', 'Error', 'Please complete all required fields');
      return;
    }

    // Check payment terms
    if (!skipTerms && this.hasPaymentTerms()) {
      this.pendingSubmitAfterTerms.set(true);
      this.openPaymentTermsSheet();
      return;
    }

    this.isSubmitting.set(true);

    // ───── Makeup flow submit ─────
    if (this.makeupMode() && category.isMakeup) {
      const ids = this.selectedItemIds();
      const slot = this.selectedTimeSlot();

      if (!f.date || ids.length === 0 || !slot) {
        this.isSubmitting.set(false);
        this.cdr.markForCheck();
        this.showAlert('error', 'Error', 'Please select date, items, and time slot');
        return;
      }

      const reservationIso = this.buildMakeupReservationDateIso(f.date, slot);

      const body: SubmitCategoryBookingBody = {
        branchId: branch.id,
        categoryId: category.id,
        reservationDate: reservationIso,
        staffId: f.staffId,
        noOfPersons: f.persons,
        serviceType: f.serviceType,
        services: ids,
        locationId: null,
        notes: f.notes
      };

      this.bookingService.submitBooking(body)
        .pipe(
          finalize(() => {
            this.isSubmitting.set(false);
            this.cdr.markForCheck();
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (res) => {
            if (res.status && res.data) {
              this.handleBookingSuccess(res.data, res.msgEN || 'Payment link sent to your WhatsApp');
            } else {
              this.showAlert('error', 'Booking Failed', res.msgEN || 'Something went wrong');
            }
          }
        });

      return;
    }

    // ───── Old flow submit ─────
    const service = this.selectedService();
    const slot = this.selectedTimeSlot();

    if (!service) {
      this.isSubmitting.set(false);
      this.cdr.markForCheck();
      this.showAlert('error', 'Error', 'Please select a service');
      return;
    }

    if (!slot) {
      this.isSubmitting.set(false);
      this.cdr.markForCheck();
      this.showAlert('error', 'Error', 'Please select a time slot');
      return;
    }

    const body: SubmitCategoryBookingBody = {
      branchId: branch.id,
      categoryId: category.id,
      reservationDate: this.buildReservationDateIso(f.date, slot),
      staffId: f.staffId,
      noOfPersons: f.persons,
      serviceType: f.serviceType,
      services: [service.id],
      locationId: null,
      notes: f.notes
    };

    this.bookingService.submitBooking(body)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          if (res.status && res.data) {
            this.handleBookingSuccess(res.data, res.msgEN || 'Payment link sent to your WhatsApp');
          } else {
            this.showAlert('error', 'Booking Failed', res.msgEN || 'Something went wrong');
          }
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLE BOOKING SUCCESS
  // ─────────────────────────────────────────────────────────────────────────

  private handleBookingSuccess(paymentLink: string, message: string): void {
    this.paymentUrl.set(paymentLink);
    this.paymentMessage.set(message);
    this.showPaymentSuccess.set(true);
    this.cdr.markForCheck();
  }

  openPaymentLink(): void {
    const url = this.paymentUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  copyPaymentLink(): void {
    const url = this.paymentUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('success', 'Payment link copied!');
      }).catch(() => {
        this.showToast('error', 'Failed to copy link');
      });
    }
  }

  closePaymentSuccess(): void {
    this.showPaymentSuccess.set(false);
    this.router.navigate(['/']);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT TERMS
  // ─────────────────────────────────────────────────────────────────────────

  openPaymentTermsSheet(): void {
    this.paymentTermsAccepted.set(false);
    this.showPaymentTermsSheet.set(true);
    this.cdr.markForCheck();
  }

  closePaymentTermsSheet(): void {
    this.showPaymentTermsSheet.set(false);
    this.pendingSubmitAfterTerms.set(false);
    this.cdr.markForCheck();
  }

  agreePaymentTermsAndContinue(): void {
    if (!this.paymentTermsAccepted()) return;

    this.showPaymentTermsSheet.set(false);
    this.cdr.markForCheck();

    if (this.pendingSubmitAfterTerms()) {
      this.pendingSubmitAfterTerms.set(false);
      this.submitBooking(true);
    }
  }

  trackByItemId = (_: number, it: ServiceItem) => it.id;

  // ─────────────────────────────────────────────────────────────────────────
  // ALERTS
  // ─────────────────────────────────────────────────────────────────────────

  private showToast(icon: 'success' | 'error', title: string): void {
    Swal.fire({
      toast: true,
      icon,
      title,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }

  private showAlert(icon: 'success' | 'error', title: string, text: string): void {
    Swal.fire({ icon, title, text });
  }

  // Track by functions
  trackByServiceId = (_: number, service: ServiceItem) => service.id;
  trackByStaffId = (_: number, staff: Staff) => staff.id;
}