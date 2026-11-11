import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonIcon, ToastController } from '@ionic/angular/standalone';
import { Equipment, EquipmentStore, Unit, localDate, message } from '../../core/inventory/equipment-store.service';
import { readQr } from '../../shared/device-media';
import { EquipmentPhoto } from '../../shared/equipment-photo/equipment-photo.component';
import { notify } from '../../shared/notifications';

@Component({ imports: [FormsModule, RouterLink, EquipmentPhoto, IonIcon], templateUrl: './borrow.page.html' })
export class BorrowEquipment {
  readonly store = inject(EquipmentStore);
  private readonly toasts = inject(ToastController);
  private requestId = crypto.randomUUID();
  readonly localDate = localDate;
  selected?: { item: Equipment; unit: Unit };
  manualId = '';
  borrower = '';
  studentId = '';
  due = '';
  error = '';
  busy = false;
  success = '';

  async identify(scan: boolean) {
    if (this.busy) return;
    this.selected = undefined;
    this.success = this.error = '';
    this.busy = true;
    try {
      if (scan && !Capacitor.isNativePlatform()) {
        this.error = 'Use the Android app to scan a QR code, or enter the Unit ID below.';
        return;
      }
      const id = scan ? await readQr() : this.manualId;
      if (scan && !id) return;
      this.selected = await this.store.find(id);
      this.manualId = this.selected.unit.unitId;
      await this.store.refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (!/cancel/i.test(detail)) this.error = message(error, scan
        ? 'Could not scan the QR code. Check camera access, try again, or enter the Unit ID.'
        : 'Could not look up this Unit ID. Try again.');
    } finally {
      this.busy = false;
    }
  }

  async submit() {
    if (this.busy || !this.selected) return;
    this.busy = true;
    this.error = this.success = '';
    const { item, unit } = this.selected;
    try {
      await this.store.borrow(unit.unitId, this.borrower, this.studentId, this.due, this.requestId);
      this.selected = undefined;
      this.manualId = this.borrower = this.studentId = this.due = '';
      this.requestId = crypto.randomUUID();
      this.success = `Loan recorded for one unit of ${item.equipmentName}.`;
    } catch (error) {
      this.error = message(error, 'Could not record the loan. Try again.');
      await this.store.refresh();
    } finally {
      this.busy = false;
    }
    if (this.success) void notify(this.toasts, this.success);
  }
}
