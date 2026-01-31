// src/app/pages/booking-category/booking-category.ts
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
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import {
  BookingCategoryService,
  Branch,
  AppointmentCategory,
  CategoryConfigData,
  Staff
} from '../../services/booking-category';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-booking-category',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './booking-category.html',
  styleUrl: './booking-category.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingCategory implements OnInit {
  private readonly router = inject(Router);
   readonly bookingService = inject(BookingCategoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  
  isLoading = signal(true);

  // Config Data
  config = signal<CategoryConfigData | null>(null);
  categories = signal<AppointmentCategory[]>([]);
  branches = signal<Branch[]>([]);
  
  // Selected Category (for branch panel)
  selectedCategory = signal<AppointmentCategory | null>(null);

  // Branch Panel State
  showBranchPanel = signal(false);
  
  // Base URLs
  categoryImageBase = signal('');
  // Makeup panel
  showMakeupPanel = signal(false);
  makeupDate = signal<string>('');
  makeupStaffLoading = signal(false);
  makeupStaffList = signal<Staff[]>([]);
  selectedMakeupBranch = signal<Branch | null>(null);
  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────

  hasMultipleBranches = computed(() => this.branches().length > 1);

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadConfig();
  }

  // Close branch panel on overlay click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('branch-panel-overlay')) {
      this.closeBranchPanel();
    }
  }

  // Handle escape key
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showBranchPanel()) {
      this.closeBranchPanel();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD CONFIG
  // ─────────────────────────────────────────────────────────────────────────

  private loadConfig(): void {
    this.bookingService.getConfigData(true)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (cfg) => {
          this.config.set(cfg);
          this.categories.set(cfg.apointmentCategories || []);
          this.branches.set(cfg.branches || []);
          this.categoryImageBase.set(cfg.base_urls?.bookingCategory_image_url || '');
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  getCategoryImage(category: AppointmentCategory): string {
    return this.bookingService.buildImageUrl(
      this.categoryImageBase(), 
      category.image,
      'assets/images/category-placeholder.svg'
    );
  }
  getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
  todayMin = signal(new Date().toISOString().split('T')[0]);
  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY SELECTION
  // ─────────────────────────────────────────────────────────────────────────

  onCategoryClick(category: AppointmentCategory): void {
    this.selectedCategory.set(category);

    if (this.branches().length === 1) {
      const br = this.branches()[0];
      if (category.isMakeup) {
        this.openMakeupPanel(category, br);
      } else {
        this.navigateToProducts(category.id, br.id);
      }
    } else if (this.branches().length > 1) {
      this.showBranchPanel.set(true);
    } else {
      // no branches
      if (category.isMakeup) {
        this.openMakeupPanel(category, null);
      } else {
        this.navigateToProducts(category.id, 0);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BRANCH PANEL
  // ─────────────────────────────────────────────────────────────────────────

  closeBranchPanel(): void {
    this.showBranchPanel.set(false);
    this.selectedCategory.set(null);
  }

  selectBranch(branch: Branch): void {
    const category = this.selectedCategory();
    if (!category) return;

    this.showBranchPanel.set(false);

    if (category.isMakeup) {
      this.openMakeupPanel(category, branch);
    } else {
      this.navigateToProducts(category.id, branch.id);
    }
  }
  //Makeup panel
  openMakeupPanel(category: AppointmentCategory, branch: Branch | null): void {
    this.selectedCategory.set(category);
    this.selectedMakeupBranch.set(branch);
    this.makeupDate.set('');
    this.makeupStaffList.set([]);
    this.showMakeupPanel.set(true);
  }

  closeMakeupPanel(): void {
    this.showMakeupPanel.set(false);
    this.makeupDate.set('');
    this.makeupStaffList.set([]);
    this.selectedMakeupBranch.set(null);
  }

  onMakeupDateChange(date: string): void {
    this.makeupDate.set(date);
    this.loadMakeupStaff();
  }

  private loadMakeupStaff(): void {
    const branch = this.selectedMakeupBranch();
    const date = this.makeupDate();
    if (!branch || !date) return;

    this.makeupStaffLoading.set(true);
    this.makeupStaffList.set([]);

    this.bookingService.getStaffAvailability(branch.id, date)
      .pipe(
        finalize(() => {
          this.makeupStaffLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(staff => this.makeupStaffList.set(staff));
  }

  selectMakeupStaff(staff: Staff): void {
    if (!staff.isAvailable) return;

    const cat = this.selectedCategory();
    const br = this.selectedMakeupBranch();
    const date = this.makeupDate();

    if (!cat || !br || !date) return;

    // روح لصفحة confirm (نفس booking-product-category) بس makeup mode
    this.showMakeupPanel.set(false);

    this.router.navigate(['/booking-product-category', cat.id, br.id], {
      queryParams: {
        makeup: 1,
        staffId: staff.id,
        date: date
      },
      state: { staff } // علشان نعرضه فوق بدون refetch
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  private navigateToProducts(categoryId: number, branchId: number): void {
    this.router.navigate(['/booking-product-category', categoryId, branchId]);
  }

  // Track by functions
  trackByCategoryId = (_: number, cat: AppointmentCategory) => cat.id;
  trackByBranchId = (_: number, branch: Branch) => branch.id;
}