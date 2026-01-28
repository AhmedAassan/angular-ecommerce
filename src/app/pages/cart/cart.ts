// src/app/pages/cart/cart.ts
import {
  Component, ChangeDetectionStrategy, HostListener, OnInit,
  inject, ChangeDetectorRef, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { CartManagerService, CartItem } from '../../services/cart-manager';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Cart implements OnInit {
  private readonly router = inject(Router);
  private readonly cartManager = inject(CartManagerService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly FREE_SHIPPING_THRESHOLD = 50;
  readonly SHIPPING_FEE = 5;
  readonly Math = Math;

  pageMode = false;
  isOpen = false;
  loading = false;
  syncing = false;
  items: CartItem[] = [];

  private readonly PLACEHOLDER = 'assets/images/placeholder.jpg';

  ngOnInit(): void {
    this.pageMode = this.router.url.startsWith('/cart');
    
    this.cartManager.items$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        this.items = items;
        this.cdr.markForCheck();
      });

    this.cartManager.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(loading => {
        this.loading = loading;
        this.cdr.markForCheck();
      });

    this.cartManager.syncing$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(syncing => {
        this.syncing = syncing;
        this.cdr.markForCheck();
      });

    if (this.pageMode) {
      this.cartManager.loadCart();
    }
  }

  @HostListener('window:cart:open')
  onCartOpenEvent() {
    if (this.pageMode) return;
    this.isOpen = true;
    this.cartManager.loadCart();
  }

  open(): void {
    this.isOpen = true;
    this.cartManager.loadCart();
  }

  close(): void {
    this.isOpen = false;
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  refresh(): void {
    this.cartManager.loadCart();
  }

  onImgError(e: Event): void {
    const img = e.target as HTMLImageElement | null;
    if (img && img.src !== this.PLACEHOLDER) {
      img.onerror = null;
      img.src = this.PLACEHOLDER;
    }
  }

  get subTotal(): number {
    return +this.items.reduce((s, i) => s + i.lineTotal, 0).toFixed(3);
  }

  get shipping(): number {
    return this.subTotal >= this.FREE_SHIPPING_THRESHOLD ? 0 : this.SHIPPING_FEE;
  }

  get total(): number {
    return +(this.subTotal + this.shipping).toFixed(3);
  }

  get freeShippingProgress(): number {
    const pct = (this.subTotal / this.FREE_SHIPPING_THRESHOLD) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  // Fixed: Use isAuthenticated() method instead of isLoggedIn()
  get isGuest(): boolean {
    return !this.auth.isAuthenticated();
  }

  changeQty(item: CartItem, newQty: number): void {
    if (newQty < 1) return;

    const prevQty = item.qty;
    item.qty = newQty;
    item.lineTotal = +(item.price * newQty).toFixed(3);
    this.cdr.markForCheck();

    this.cartManager.updateQty(item, newQty)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(success => {
        if (!success) {
          item.qty = prevQty;
          item.lineTotal = +(item.price * prevQty).toFixed(3);
          this.cdr.markForCheck();
          Swal.fire({ icon: 'error', title: 'Could not update quantity' });
        }
      });
  }

  async remove(item: CartItem): Promise<void> {
    const res = await Swal.fire({
      icon: 'warning',
      title: 'Remove item?',
      text: item.name,
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel'
    });
    
    if (!res.isConfirmed) return;

    this.cartManager.removeItem(item)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(success => {
        if (success) {
          Swal.fire({ toast: true, icon: 'success', title: 'Removed', position: 'top-end', timer: 1200, showConfirmButton: false });
        } else {
          Swal.fire({ icon: 'error', title: 'Could not remove item' });
        }
      });
  }

  async clearAll(): Promise<void> {
    const res = await Swal.fire({
      icon: 'warning',
      title: 'Clear cart?',
      text: 'This will remove all items.',
      showCancelButton: true,
      confirmButtonText: 'Clear',
      cancelButtonText: 'Cancel'
    });
    
    if (!res.isConfirmed) return;

    this.cartManager.clearCart()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(success => {
        if (success) {
          Swal.fire({ toast: true, icon: 'success', title: 'Cart cleared', position: 'top-end', timer: 1200, showConfirmButton: false });
        } else {
          Swal.fire({ icon: 'error', title: 'Could not clear cart' });
        }
      });
  }

  proceedToCheckout(): void {
    if (this.isGuest) {
      Swal.fire({
        icon: 'info',
        title: 'Login Required',
        text: 'Please login to complete your purchase. Your cart will be saved.',
        showCancelButton: true,
        confirmButtonText: 'Login',
        cancelButtonText: 'Continue Shopping'
      }).then(res => {
        if (res.isConfirmed) {
          sessionStorage.setItem('checkout_redirect', '/checkout');
          this.router.navigate(['/login']);
        }
      });
      return;
    }
    
    this.router.navigate(['/checkout']);
  }

  trackById = (_: number, it: CartItem) => it.id;
}