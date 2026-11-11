import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Equipment, EquipmentStore, message } from '../../core/inventory/equipment-store.service';
import { capture, resizePhoto } from '../../shared/device-media';
import { EquipmentPhoto } from '../../shared/equipment-photo/equipment-photo.component';
import { UnitLabels } from '../../shared/unit-labels/unit-labels.component';

@Component({ imports: [FormsModule, RouterLink, IonIcon, UnitLabels, EquipmentPhoto], templateUrl: './add-equipment.page.html' })
export class AddEquipment implements OnDestroy {
  readonly store = inject(EquipmentStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('itemId');
  readonly editing = this.id !== null;
  readonly original = this.store.records().equipment.find(item => item.itemId === this.id);
  readonly native = Capacitor.isNativePlatform();
  readonly camera = CameraSource.Camera;
  readonly gallery = CameraSource.Photos;
  name = this.original?.equipmentName ?? '';
  quantity: number | null = this.original?.totalQuantity ?? null;
  photo?: Blob;
  preview = '';
  busy = false;
  error = '';
  saved?: Equipment;
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
    if (this.busy || this.saved || (this.editing && !this.original)) return;
    this.error = '';
    this.busy = true;
    try {
      this.saved = await this.store.save(this.id, this.name, this.quantity, this.photo);
    } catch (error) {
      this.error = message(error, 'Could not save this equipment. Check device storage and try again.');
    } finally {
      this.busy = false;
    }
  }

  reset() {
    if (this.preview) URL.revokeObjectURL(this.preview);
    this.name = this.preview = this.error = '';
    this.quantity = null;
    this.photo = this.saved = undefined;
  }
}
