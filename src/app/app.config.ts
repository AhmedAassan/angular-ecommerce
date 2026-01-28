// src/app/app.config.ts
import { 
  ApplicationConfig, 
  provideZonelessChangeDetection,
  isDevMode,
  APP_INITIALIZER
} from '@angular/core';
import { provideRouter, withViewTransitions, withRouterConfig } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { 
  provideHttpClient, 
  withFetch, 
  withInterceptors,
  withInterceptorsFromDi 
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { authInterceptor, errorInterceptor } from './core/auth.interceptor';
import { AppModeService } from './services/app-mode';

// ═══════════════════════════════════════════════════════════════════════════
// APP INITIALIZER FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Factory function to initialize app mode before app starts
 * Determines if app runs in 'booking' or 'ecommerce' mode
 */
function initializeAppMode(appModeService: AppModeService): () => Promise<any> {
  return () => appModeService.initializeAsync();
}

// ═══════════════════════════════════════════════════════════════════════════
// APP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const appConfig: ApplicationConfig = {
  providers: [
    // ===== Core Angular Providers =====
    
    // Zoneless change detection (Angular 18+)
    provideZonelessChangeDetection(),
    
    // Router configuration
    provideRouter(
      routes,
      // Optional: Enable view transitions for smooth page animations
      withViewTransitions(),
      // Optional: Router configuration options
      withRouterConfig({
        onSameUrlNavigation: 'reload',
        paramsInheritanceStrategy: 'always'
      })
    ),
    
    // SSR Hydration with event replay
    provideClientHydration(withEventReplay()),
    
    // HTTP Client with interceptors
    provideHttpClient(
      withFetch(),
      withInterceptors([
        authInterceptor,
        errorInterceptor, // Optional: global error logging
      ])
    ),
    
    // Animations (needed for some UI libraries and Angular Material)
    provideAnimations(),

    // ===== App Mode Initialization =====
    // Determines booking vs ecommerce mode based on apointmentCategories
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppMode,
      deps: [AppModeService],
      multi: true
    }
  ]
};