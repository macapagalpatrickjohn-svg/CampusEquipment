import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const ADMIN_PIN = '2026';

@Injectable({ providedIn: 'root' })
export class AdminAccess {
  private readonly session = signal(false);
  readonly unlocked = this.session.asReadonly();

  login(pin: string) {
    if (pin !== ADMIN_PIN) return false;
    this.session.set(true);
    return true;
  }

  logout() {
    this.session.set(false);
  }
}

export const requireAdmin: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AdminAccess).unlocked() || router.createUrlTree(['/admin'], { queryParams: { next: state.url } });
};