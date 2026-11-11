import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonApp, IonContent, IonIcon } from '@ionic/angular/standalone';
import { AdminAccess } from './core/admin/admin-access.service';
import { EquipmentStore } from './core/inventory/equipment-store.service';

@Component({
  selector: 'campus-root',
  imports: [IonApp, IonContent, IonIcon, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
})
export class CampusApp {
  readonly store = inject(EquipmentStore);
  readonly admin = inject(AdminAccess);
  private readonly router = inject(Router);
  readonly tabs = [
    { path: '/', label: 'Home', icon: 'grid-outline' },
    { path: '/add', label: 'Add', icon: 'cube-outline' },
    { path: '/inventory', label: 'Inventory', icon: 'layers-outline' },
    { path: '/borrow', label: 'Borrow', icon: 'qr-code-outline' },
    { path: '/loans', label: 'Loans', icon: 'reader-outline' },
  ];

  lock() {
    this.admin.logout();
    if (this.router.url === '/add' || this.router.url.endsWith('/edit')) void this.router.navigateByUrl('/inventory');
  }

  constructor() {
    const router = this.router;
    router.events.subscribe(event => {
      if (event instanceof NavigationEnd) void this.store.refresh();
    });
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void this.store.refresh();
      });
      void App.addListener('backButton', () => {
        if (document.querySelector('ion-alert')) return;
        if (router.url !== '/') void router.navigateByUrl('/');
        else void App.minimizeApp();
      });
    }
  }
}
