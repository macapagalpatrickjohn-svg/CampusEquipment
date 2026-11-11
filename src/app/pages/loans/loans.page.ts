import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonIcon, ToastController } from '@ionic/angular/standalone';
import { EquipmentStore, Loan, localDate, message } from '../../core/inventory/equipment-store.service';
import { EquipmentPhoto } from '../../shared/equipment-photo/equipment-photo.component';
import { notify } from '../../shared/notifications';

@Component({ imports: [RouterLink, EquipmentPhoto, DatePipe, IonIcon], templateUrl: './loans.page.html' })
export class BorrowedEquipment {
  readonly store = inject(EquipmentStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly localDate = localDate;
  readonly history = signal(false);
  pending = '';
  error = '';
  success = '';

  async confirm(loan: Loan) {
    if (this.pending) return;
    this.pending = loan.borrowId;
    this.error = this.success = '';
    try {
      const alert = await this.alerts.create({
        header: 'Confirm return',
        message: 'Mark this loan as returned and put one unit back in stock?',
        buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Confirm return', role: 'confirm' }],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'confirm') return;
      await this.store.returnLoan(loan.borrowId);
      this.success = `${loan.equipmentName} returned. One unit is available again.`;
    } catch (error) {
      this.error = message(error, 'Could not return this loan. Try again.');
      await this.store.refresh();
    } finally {
      this.pending = '';
    }
    if (this.success) void notify(this.toasts, this.success);
  }
}
