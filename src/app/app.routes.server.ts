import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'category/:slug', renderMode: RenderMode.Client },
  { path: 'product/:id',   renderMode: RenderMode.Client },
  { path: 'booking-product-category/:categoryId/:branchId',   renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
