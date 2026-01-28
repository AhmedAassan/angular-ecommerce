// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './services/auth-guard';
import { bookingModeGuard, ecommerceModeGuard } from './core/booking-mode';

export const routes: Routes = [
  // ═══════════════════════════════════════════════════════════════════════
  // COMMON ROUTES (Available in both modes)
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: 'category/:id',
    loadComponent: () => import('./pages/category/category').then(m => m.Category)
  },
  {
    path: 'product/:itemId',
    loadComponent: () => import('./pages/product-details/product-details').then(m => m.ProductDetails)
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact').then(m => m.Contact)
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then(m => m.About)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy').then(m => m.PrivacyPolicy)
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then(m => m.Cart)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then(m => m.Register)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then(m => m.Profile)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },
  {
    path: 'addresses',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/addresses/addresses').then(m => m.Addresses)
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/checkout/checkout').then(m => m.Checkout)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // BOOKING MODE ROUTES (Only when apointmentCategories exists)
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: 'booking-Checkout',
    canActivate: [authGuard, bookingModeGuard],
    loadComponent: () => import('./pages/booking/booking').then(m => m.Booking)
  },
  {
    path: 'booking-category',
    canActivate: [bookingModeGuard],
    loadComponent: () => import('./pages/booking-category/booking-category').then(m => m.BookingCategory)
  },
  {
    path: 'booking-product-category/:categoryId/:branchId',
    canActivate: [bookingModeGuard],
    loadComponent: () => import('./pages/booking-product-category/booking-product-category').then(m => m.BookingProductCategory)
  },
  {
    path: 'booking-billing',
    canActivate: [authGuard, bookingModeGuard],
    loadComponent: () => import('./pages/booking-billing/booking-billing').then(m => m.BookingBilling),
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ECOMMERCE MODE ROUTES (Only when apointmentCategories does NOT exist)
  // ═══════════════════════════════════════════════════════════════════════
  // {
  //   path: 'orders',
  //   canActivate: [authGuard, ecommerceModeGuard, bookingModeGuard],
  //   loadComponent: () => import('./pages/customer-invoices/customer-invoices').then(m => m.CustomerInvoices),
  // },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/customer-invoices/customer-invoices').then(m => m.CustomerInvoices),
  },
  {
    path: 'home',
    canActivate: [ecommerceModeGuard],
    loadComponent: () => import('./pages/home/home').then(m => m.Home)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DYNAMIC HOME PAGE
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: '',
    loadComponent: () => import('./pages/dynamic-home/dynamic-home').then(m => m.DynamicHome)
  },

  // Wildcard - redirect to homepage
  { path: '**', redirectTo: '', pathMatch: 'full' }
];