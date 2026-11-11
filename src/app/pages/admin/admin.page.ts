import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { AdminAccess } from '../../core/admin/admin-access.service';

@Component({ imports: [FormsModule, RouterLink, IonIcon], templateUrl: './admin.page.html' })
export class AdminPage {
  readonly admin = inject(AdminAccess);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  pin = '';
  error = '';

  login() {
    if (!this.admin.login(this.pin)) {
      this.error = 'Incorrect PIN. Enter the 4-digit admin passcode.';
      this.pin = '';
      return;
    }
    this.pin = this.error = '';
    const next = this.route.snapshot.queryParamMap.get('next') ?? '';
    if (next === '/add' || /^\/inventory\/[0-9A-Fa-f-]{36,39}\/edit$/.test(next)) {
      void this.router.navigateByUrl(next, { replaceUrl: true });
    } else {
      void this.router.navigateByUrl('/inventory', { replaceUrl: true });
    }
  }
}
