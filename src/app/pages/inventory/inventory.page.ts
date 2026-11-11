import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertController, IonIcon } from '@ionic/angular/standalone';
import { AdminAccess } from '../../core/admin/admin-access.service';
import { Equipment, EquipmentStore, message } from '../../core/inventory/equipment-store.service';
import { EquipmentPhoto } from '../../shared/equipment-photo/equipment-photo.component';
import { UnitLabels } from '../../shared/unit-labels/unit-labels.component';

@Component({ imports: [RouterLink, FormsModule, EquipmentPhoto, IonIcon, UnitLabels], templateUrl: './inventory.page.html' })
export class Inventory {
  readonly store = inject(EquipmentStore);
  readonly admin = inject(AdminAccess);
  private readonly alerts = inject(AlertController);
  private readonly selectedId = signal('');
  readonly query = signal('');
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.store.records().equipment.filter(item => item.equipmentName.toLowerCase().includes(query)
      || this.store.unitsFor(item.itemId).some(unit => unit.unitId.toLowerCase().includes(query)));
  });
  readonly selected = computed(() => this.store.records().equipment.find(item => item.itemId === this.selectedId()));
  pending = false;
  error = '';
  success = '';

  select(item: Equipment) {
    this.selectedId.set(item.itemId);
    requestAnimationFrame(() => document.getElementById('unit-panel')?.scrollIntoView({ block: 'start' }));
  }

  close() {
    this.selectedId.set('');
  }

  async remove(item: Equipment) {
    if (this.pending || !this.admin.unlocked()) return;
    this.pending = true;
    this.error = this.success = '';
    try {
      const alert = await this.alerts.create({
        header: 'Delete equipment?',
        message: 'This removes the equipment and its unit labels from Inventory. Completed loans stay in History.',
        buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Delete equipment', role: 'confirm' }],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'confirm') return;
      await this.store.delete(item.itemId);
      if (this.selectedId() === item.itemId) this.close();
      this.success = item.equipmentName + ' was deleted from Inventory.';
      requestAnimationFrame(() => document.getElementById('inventory-heading')?.scrollIntoView({ block: 'start' }));
    } catch (error) {
      this.error = message(error, 'Could not delete this equipment. Try again.');
      requestAnimationFrame(() => document.getElementById('inventory-feedback')?.scrollIntoView({ block: 'start' }));
    } finally {
      this.pending = false;
    }
  }
}
