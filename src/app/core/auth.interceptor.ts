// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { catchError, Observable, of, switchMap, throwError, from, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

// ==================== CONFIGURATION ====================

/** Endpoints that should NOT have auth headers added */
const PUBLIC_ENDPOINTS = [
  '/externalLogin',
  '/refresh-token',
  '/requestOtpNumber',
  '/ValidateOtpNumber',
  '/registerExternalUser',
  '/GetBranches',
  '/GetProducts',
  '/GetProductById',
  '/GetCategories',
  '/GetCategoryById',
  // Add other public endpoints here
];

/** Endpoints that can work both with and without auth (guest-friendly) */
const OPTIONAL_AUTH_ENDPOINTS = [
  '/GetProducts',
  '/GetProductById',
  '/GetCategories',
  // These work for guests but may return different data for logged-in users
];

/** Endpoints that require auth - 401 should trigger login redirect */
const PROTECTED_ENDPOINTS = [
  '/AddItemCart',
  '/UpdateItemCart',
  '/DeleteItemCart',
  '/DeleteAllItemCart',
  '/GetItemsCart',
  '/Checkout',
  '/GetOrders',
  '/GetUserProfile',
  // Add other protected endpoints here
];

// ==================== STATE MANAGEMENT ====================

/** Track if a token refresh is in progress */
let refreshInFlight = false;

/** Queue of requests waiting for refresh to complete */
let refreshWaiters: Array<{ resolve: () => void; reject: (err: any) => void }> = [];

/** Prevent multiple session expired toasts */
let sessionToastShown = false;

// ==================== HELPER FUNCTIONS ====================

/**
 * Wait for an ongoing refresh to complete
 */
function waitForRefresh(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    refreshWaiters.push({ resolve, reject });
  });
}

/**
 * Resolve all waiting requests after refresh completes
 */
function resolveWaiters(): void {
  refreshInFlight = false;
  refreshWaiters.forEach(w => w.resolve());
  refreshWaiters = [];
}

/**
 * Reject all waiting requests if refresh fails
 */
function rejectWaiters(err: any): void {
  refreshInFlight = false;
  refreshWaiters.forEach(w => w.reject(err));
  refreshWaiters = [];
}

/**
 * Show session expired toast only once
 */
function showSessionExpiredToastOnce(): void {
  if (sessionToastShown) return;
  sessionToastShown = true;

  void Swal.fire({
    icon: 'warning',
    title: 'Session expired',
    text: 'Please sign in again to continue.',
    toast: true,
    position: 'top-end',
    timer: 4000,
    timerProgressBar: true,
    showConfirmButton: false,
    didClose: () => {
      sessionToastShown = false;
    }
  });
}

/**
 * Check if URL matches any pattern in the list
 */
function matchesEndpoint(url: string, endpoints: string[]): boolean {
  return endpoints.some(endpoint => url.includes(endpoint));
}

/**
 * Check if request is for a public endpoint (no auth needed)
 */
function isPublicEndpoint(url: string): boolean {
  return matchesEndpoint(url, PUBLIC_ENDPOINTS);
}

/**
 * Check if request is for a protected endpoint (auth required)
 */
function isProtectedEndpoint(url: string): boolean {
  return matchesEndpoint(url, PROTECTED_ENDPOINTS);
}

/**
 * Clone request with authorization header
 */
function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

/**
 * Handle redirect to login page
 */
function redirectToLogin(router: Router, returnUrl?: string): void {
  const url = returnUrl || router.url || '/';
  // Don't redirect if already on login/register pages
  if (url.includes('/login') || url.includes('/register')) {
    return;
  }
  router.navigate(['/login'], { 
    queryParams: { returnUrl: url },
    replaceUrl: true 
  });
}

// ==================== MAIN INTERCEPTOR ====================

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const platformId = inject(PLATFORM_ID);
  
  // Skip interceptor logic on server-side rendering
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const auth = injector.get(AuthService);
  const router = injector.get(Router);

  // ===== 1. Skip auth for public endpoints =====
  if (isPublicEndpoint(req.url)) {
    return next(req);
  }

  // ===== 2. Check if user is authenticated =====
  const token = auth.getAccessToken();
  const isAuthenticated = !!token;

  // ===== 3. Handle unauthenticated requests =====
  if (!isAuthenticated) {
    // For protected endpoints without auth, just send the request
    // The server will return 401, which we handle below
    // This allows the error to bubble up to the component
    if (isProtectedEndpoint(req.url)) {
      return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) {
            // User tried to access protected resource without auth
            // Don't show session expired - they were never logged in
            redirectToLogin(router);
          }
          return throwError(() => err);
        })
      );
    }
    // For other endpoints, send without auth
    return next(req);
  }

  // ===== 4. Proactive token refresh before request =====
  const ensureFreshToken$: Observable<boolean> = refreshInFlight
    ? from(waitForRefresh()).pipe(switchMap(() => of(true)))
    : auth.refreshTokenIfNeeded();

  return ensureFreshToken$.pipe(
    // Handle proactive refresh failure
    catchError(err => {
      resolveWaiters();
      // Don't logout on network errors during proactive refresh
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 400)) {
        auth.logout(true);
        showSessionExpiredToastOnce();
        redirectToLogin(router);
      }
      return throwError(() => err);
    }),

    // Send the request with fresh token
    switchMap(() => {
      const freshToken = auth.getAccessToken();
      const authReq = freshToken ? addAuthHeader(req, freshToken) : req;

      return next(authReq).pipe(
        catchError((err: HttpErrorResponse) => {
          // ===== 5. Handle non-401 errors =====
          if (err.status !== 401) {
            return throwError(() => err);
          }

          // ===== 6. Handle 401 - Token might have just expired =====
          
          // If another refresh is in flight, wait for it
          if (refreshInFlight) {
            return from(waitForRefresh()).pipe(
              switchMap(() => {
                const retryToken = auth.getAccessToken();
                if (!retryToken) {
                  return throwError(() => err);
                }
                const retryReq = addAuthHeader(req, retryToken);
                return next(retryReq);
              }),
              catchError(() => throwError(() => err))
            );
          }

          // Start a new refresh
          refreshInFlight = true;

          return auth.refreshToken().pipe(
            switchMap(success => {
              resolveWaiters();

              if (!success) {
                auth.logout(true);
                showSessionExpiredToastOnce();
                redirectToLogin(router);
                return throwError(() => err);
              }

              // Retry original request with new token
              const newToken = auth.getAccessToken();
              if (!newToken) {
                return throwError(() => err);
              }
              const retryReq = addAuthHeader(req, newToken);
              return next(retryReq);
            }),
            catchError(refreshErr => {
              rejectWaiters(refreshErr);
              auth.logout(true);
              showSessionExpiredToastOnce();
              redirectToLogin(router);
              return throwError(() => refreshErr);
            })
          );
        })
      );
    })
  );
};

// ==================== OPTIONAL: No-Auth Interceptor for Guest Operations ====================

/**
 * Alternative interceptor for requests that should never have auth
 * Use this if you need to explicitly make unauthenticated requests
 */
export const noAuthInterceptor: HttpInterceptorFn = (req, next) => {
  // Simply pass through without any auth modifications
  return next(req);
};

// ==================== OPTIONAL: Loading Interceptor ====================

/**
 * Interceptor to track loading state globally
 * Useful for showing loading indicators
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // You could inject a LoadingService here and call start/stop
  return next(req);
};

// ==================== OPTIONAL: Error Interceptor ====================

/**
 * Global error handling interceptor
 * Catches and logs all HTTP errors
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Log error for debugging
      console.error(`HTTP Error: ${err.status} - ${req.method} ${req.url}`, err);

      // Handle specific error codes
      switch (err.status) {
        case 0:
          // Network error
          console.error('Network error - check your connection');
          break;
        case 403:
          // Forbidden
          console.error('Access forbidden');
          break;
        case 404:
          // Not found
          console.error('Resource not found');
          break;
        case 500:
          // Server error
          console.error('Server error');
          break;
      }

      return throwError(() => err);
    })
  );
};