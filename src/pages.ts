import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { CameraSource } from '@capacitor/camera';
import { AlertController, IonIcon, ToastController } from '@ionic/angular/standalone';
import { Equipment, EquipmentStore, Loan, localDate, message } from './data';
import { EquipmentPhoto, capture, downloadQr, makeQr, readQr, resizePhoto } from './media';

async function notify(toasts: ToastController, message: string) {
  const toast = await toasts.create({ message, duration: 3400, position: 'top' });
  await toast.present();
}

@Component({ imports: [RouterLink, IonIcon], templateUrl: './dashboard.html' })
export class Dashboard {
  private readonly store = inject(EquipmentStore);
  readonly totals = computed(() => {
    const { equipment, active } = this.store.records();
    const units = equipment.reduce((sum, item) => sum + item.totalQuantity, 0);
    return { types: equipment.length, units, borrowed: active.length, available: units - active.length };
  });
}

@Component({ imports: [FormsModule, RouterLink, IonIcon], templateUrl: './add.html' })
export class AddEquipment implements OnDestroy {
  private readonly store = inject(EquipmentStore);
  readonly native = Capacitor.isNativePlatform();
  readonly camera = CameraSource.Camera;
  readonly gallery = CameraSource.Photos;
  name = '';
  quantity: number | null = null;
  photo?: Blob;
  preview = '';
  busy = false;
  error = '';
  saved?: Equipment;
  qr = '';
  qrFeedback = '';
  private destroyed = false;

  ngOnDestroy() {
    this.destroyed = true;
    if (this.preview) URL.revokeObjectURL(this.preview);
  }

  private setPhoto(blob: Blob) {
    if (this.destroyed) return;
    if (this.preview) URL.revokeObjectURL(this.preview);
    this.photo = blob;
    this.preview = URL.createObjectURL(blob);
  }

  async pick(source: CameraSource) {
    if (this.busy) return;
    this.error = '';
    this.busy = true;
    try {
      this.setPhoto(await capture(source));
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (!/cancel/i.test(detail)) this.error = 'Could not open or read the photo. Check camera access or try the gallery.';
    } finally {
      this.busy = false;
    }
  }

  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy) return;
    this.error = '';
    this.busy = true;
    try {
      this.setPhoto(await resizePhoto(file));
    } catch {
      this.error = 'Choose a readable image smaller than 30 MB.';
    } finally {
      this.busy = false;
    }
  }

  async submit() {
    if (this.busy || this.saved) return;
    this.error = '';
    this.busy = true;
    try {
      this.saved = await this.store.add(this.name, this.quantity, this.photo);
      await this.renderQr();
    } catch (error) {
      this.error = message(error, 'Could not save this equipment. Check device storage and try again.');
    } finally {
      this.busy = false;
    }
  }

  async renderQr() {
    if (!this.saved) return;
    try {
      this.qr = await makeQr(this.saved.itemId);
      this.qrFeedback = '';
    } catch {
      this.qrFeedback = 'Equipment saved. Could not generate the QR preview. Try again or open Inventory.';
    }
  }

  async download() {
    if (!this.saved || !this.qr || this.busy) return;
    this.busy = true;
    try {
      this.qrFeedback = await downloadQr(this.saved.itemId, this.qr);
    } catch {
      this.qrFeedback = 'Could not save the PNG. Check available device storage and try again.';
    } finally {
      this.busy = false;
    }
  }

  reset() {
    if (this.preview) URL.revokeObjectURL(this.preview);
    this.name = this.preview = this.qr = this.qrFeedback = this.error = '';
    this.quantity = null;
    this.photo = this.saved = undefined;
  }
}

@Component({ imports: [RouterLink, EquipmentPhoto, IonIcon], templateUrl: './inventory.html' })
export class Inventory {
  readonly store = inject(EquipmentStore);
  readonly selected = signal<Equipment | undefined>(undefined);
  qr = '';
  feedback = '';
  busy = false;

  async showQr(item: Equipment) {
    if (this.busy) return;
    this.selected.set(item);
    this.qr = this.feedback = '';
    this.busy = true;
    try {
      this.qr = await makeQr(item.itemId);
    } catch {
      this.feedback = 'Could not generate the QR preview. Try opening it again.';
    } finally {
      this.busy = false;
    }
  }

  async download() {
    const item = this.selected();
    if (!item || !this.qr || this.busy) return;
    this.busy = true;
    try {
      this.feedback = await downloadQr(item.itemId, this.qr);
    } catch {
      this.feedback = 'Could not save the PNG. Check available device storage and try again.';
    } finally {
      this.busy = false;
    }
  }
}

@Component({ imports: [FormsModule, RouterLink, EquipmentPhoto, IonIcon], templateUrl: './borrow.html' })
export class BorrowEquipment {
  readonly store = inject(EquipmentStore);
  private readonly toasts = inject(ToastController);
  private requestId = crypto.randomUUID();
  readonly localDate = localDate;
  item?: Equipment;
  manualId = '';
  borrower = '';
  studentId = '';
  due = '';
  error = '';
  busy = false;
  success = '';

  async identify(scan: boolean) {
    if (this.busy) return;
    this.item = undefined;
    this.success = this.error = '';
    this.busy = true;
    try {
      if (scan && !Capacitor.isNativePlatform()) {
        this.error = 'Use the Android app to scan a QR code, or enter the Item ID below.';
        return;
      }
      const id = scan ? await readQr() : this.manualId;
      if (scan && !id) return;
      this.item = await this.store.find(id);
      this.manualId = this.item.itemId;
      await this.store.refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (!/cancel/i.test(detail)) this.error = message(error, scan
        ? 'Could not scan the QR code. Check camera access, try again, or enter the Item ID.'
        : 'Could not look up this Item ID. Try again.');
    } finally {
      this.busy = false;
    }
  }

  async submit() {
    if (this.busy || !this.item) return;
    this.busy = true;
    this.error = this.success = '';
    const item = this.item;
    try {
      await this.store.borrow(item.itemId, this.borrower, this.studentId, this.due, this.requestId);
      this.item = undefined;
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

@Component({ imports: [RouterLink, EquipmentPhoto, DatePipe, IonIcon], templateUrl: './loans.html' })
export class BorrowedEquipment {
  readonly store = inject(EquipmentStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly localDate = localDate;
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