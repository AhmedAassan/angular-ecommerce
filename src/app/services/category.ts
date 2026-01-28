import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ApiCategory {
  id: number;
  name: string;
  parent_id: number | null;
  position: number;
  status: number;
  image: string | null;
  created_at: string;
  updated_at: string | null;
}

interface CategoriesResponse {
  categories: ApiCategory[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable({
  providedIn: 'root'
})
export class Category {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly base = environment.apiBase;
  private readonly apiUrl = `${this.base}/api/categories`;

  getCategories(): Observable<ApiCategory[]> {
    // ✅ Option 2: Skip API call during SSR (Server-Side Rendering)
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[SSR] Skipping categories API call');
      return of([]);
    }

    // ✅ Option 4: Proper error handling
    return this.http.get<CategoriesResponse>(this.apiUrl).pipe(
      map(response => response.categories ?? []),
      catchError(error => {
        console.error('[Category Service] API Error:', error.message);
        return of([]); // Return empty array instead of crashing
      })
    );
  }
}