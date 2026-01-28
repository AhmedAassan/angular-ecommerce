// src/app/core/booking-mode.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppModeService } from '../services/app-mode';

/**
 * Guard that only allows access in booking mode
 * Redirects to home if in ecommerce mode
 */
export const bookingModeGuard: CanActivateFn = () => {
  const appMode = inject(AppModeService);
  const router = inject(Router);

  if (appMode.isBookingMode()) {
    return true;
  }
  
  console.log('[Guard] Booking route blocked - app is in ecommerce mode');
  return router.createUrlTree(['/']);
};

/**
 * Guard that only allows access in ecommerce mode
 * Redirects to home if in booking mode
 */
export const ecommerceModeGuard: CanActivateFn = () => {
  const appMode = inject(AppModeService);
  const router = inject(Router);

  if (appMode.isEcommerceMode()) {
    return true;
  }
  
  console.log('[Guard] Ecommerce route blocked - app is in booking mode');
  return router.createUrlTree(['/']);
};