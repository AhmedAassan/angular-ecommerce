import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAppInitializer, inject } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './app/services/auth';
import { Router } from '@angular/router';
import { authInterceptor } from './app/core/auth.interceptor';
import Swal from 'sweetalert2';
import 'bootstrap';

// Silent, non-blocking refresh on app start with improved error handling
function authInit() {
  const auth = inject(AuthService);
  const router = inject(Router);

  return firstValueFrom(
    auth.refreshTokenIfNeeded().pipe(
      catchError(err => {
        console.log('Auth initialization failed:', err);
        
        // Different handling based on error type
        if (err?.status === 400 || err?.status === 401) {
          // Expected: refresh token expired after long inactivity
          console.log('Refresh token expired, redirecting to login');
          auth.logout(true); // Silent logout
          
          // Only show toast if user is not already on login page
          const currentUrl = router.url;
          if (!currentUrl.includes('/login')) {
            Swal.fire({
              icon: 'info',
              title: 'Welcome back!',
              text: 'Please sign in to continue.',
              toast: true,
              position: 'top-end',
              timer: 3000,
              showConfirmButton: false,
              timerProgressBar: true
            });
            router.navigate(['/login']);
          }
        } else {
          // Unexpected error (network issues, etc.)
          console.error('Unexpected auth error:', err);
          
          // Still logout but show different message
          auth.logout(true);
          Swal.fire({
            icon: 'warning',
            title: 'Connection issue',
            text: 'Please check your connection and sign in.',
            toast: true,
            position: 'top-end',
            timer: 4000,
            showConfirmButton: false,
            timerProgressBar: true
          });
          router.navigate(['/login']);
        }
        
        return of(false);
      })
    )
  ).then(() => {
    // App initialization completed
    console.log('App initialization completed');
  });
}

bootstrapApplication(App, {
  ...appConfig,
  providers: [
  ...(appConfig.providers || []),
  provideAnimations(),
  provideHttpClient(withInterceptors([authInterceptor])),
  provideAppInitializer(authInit),
  ],
  })
  .then(() => {
  const splash = document.getElementById('app-splash');
  if (splash) {
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 300);
  }
  }).catch(err => {
    console.error('App bootstrap failed:', err);
    const splash = document.getElementById('app-splash');
    if (splash) splash.remove(); 
    });