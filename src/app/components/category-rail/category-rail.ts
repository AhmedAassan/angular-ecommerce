// category-rail.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnInit,
  ChangeDetectorRef,
  signal,
  computed,
  inject,
  DestroyRef,
  PLATFORM_ID
} from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Category } from '../../services/category';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  position?: number;
  status?: number;
}

@Component({
  selector: 'app-category-rail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './category-rail.html',
  styleUrls: ['./category-rail.scss']
})
export class CategoryRail implements OnInit, AfterViewInit {
  @ViewChild('railContainer') railContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('leftBtn') leftBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('rightBtn') rightBtn?: ElementRef<HTMLButtonElement>;

  // DI
  private readonly categoryService = inject(Category);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  // Signals
  categories = signal<CategoryItem[]>([]);
  selectedCategoryId = signal<number | null>(null);
  isLoading = signal(true);
  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  // Computed
  hasCategories = computed(() => this.categories().length > 0);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    // Watch query params to sync selected category
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const cid = params['categoryId'];
        const asNum = cid != null ? Number(cid) : null;
        this.selectedCategoryId.set(
          asNum != null && !Number.isNaN(asNum) ? asNum : null
        );
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.updateScrollButtons();
        this.cdr.detectChanges();
      }, 100);
    }
  }

  /* ================= public API ================ */

  scrollLeft(): void {
    if (!this.railContainer || !this.isBrowser) return;
    const container = this.railContainer.nativeElement;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }

  scrollRight(): void {
    if (!this.railContainer || !this.isBrowser) return;
    const container = this.railContainer.nativeElement;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  onScroll(): void {
    if (this.isBrowser) this.updateScrollButtons();
  }

  trackByCategory(index: number, category: CategoryItem): number {
    return category.id;
  }

  /* ================= private =================== */

  private loadCategories(): void {
    this.isLoading.set(true);

    this.categoryService.getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apiCats) => {
          const items: CategoryItem[] = (apiCats ?? [])
            .filter(c => c.status === 1)
            .sort((a, b) =>
              (a.position - b.position) ||
              (a.name ?? '').localeCompare(b.name ?? '')
            )
            .map(c => ({
              id: c.id,
              name: (c.name ?? '').trim(),
              slug: this.toSlug(c.name ?? ''),
              image: c.image ?? null,
              position: c.position,
              status: c.status
            }));

          this.categories.set(items);
          this.isLoading.set(false);

          if (this.isBrowser) {
            setTimeout(() => this.updateScrollButtons(), 150);
          }
        },
        error: (err) => {
          console.error('Failed to load categories:', err);
          this.categories.set([]);
          this.isLoading.set(false);
        }
      });
  }

  private updateScrollButtons(): void {
    if (!this.railContainer || !this.isBrowser) return;

    const container = this.railContainer.nativeElement;
    const { scrollLeft, scrollWidth, clientWidth } = container;

    this.canScrollLeft.set(scrollLeft > 5);
    this.canScrollRight.set(scrollLeft < scrollWidth - clientWidth - 5);
  }

  private toSlug(s: string): string {
    return s.trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/\-+/g, '-');
  }

  /* ============ template helpers ============== */

  isCategorySelected(categoryId: number): boolean {
    return this.selectedCategoryId() === categoryId;
  }

  isAllCategoriesSelected(): boolean {
    return this.selectedCategoryId() === null;
  }
}