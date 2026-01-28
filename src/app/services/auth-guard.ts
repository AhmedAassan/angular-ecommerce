import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ Require a valid session for all guarded routes
  const hasToken = !!auth.getAccessToken();
  if (hasToken) {
    return true;
  }

  // 🚪 Redirect to login with returnUrl if not authenticated
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
