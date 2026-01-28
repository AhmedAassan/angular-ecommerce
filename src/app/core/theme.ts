import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppTheme =
  | 'light'
  | 'dark'
  | 'orange'
  | 'blue'
  | 'green'
  | 'blue-dark'
  | 'green-dark'
  | 'velvet-rose'
  | 'velvet-rose-dark'
  | 'graphite-mist'
  | 'graphite-mist-dark';

@Injectable({
  providedIn: 'root',
})
export class Theme {
  private readonly themeKey = 'app-theme';
  private readonly platformId = inject(PLATFORM_ID);

  setTheme(theme: AppTheme): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(this.themeKey, theme);
    }
  }

  initTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(this.themeKey) as AppTheme | null;
      this.setTheme(savedTheme || 'light'); // Default fallback
    }
  }
}
