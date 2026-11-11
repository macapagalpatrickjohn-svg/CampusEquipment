import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { EquipmentStore, Unit } from '../../core/inventory/equipment-store.service';
import { downloadQr, makeQr } from '../device-media';

@Component({ selector: 'unit-labels', imports: [IonIcon], templateUrl: './unit-labels.component.html' })
export class UnitLabels {
  readonly store = inject(EquipmentStore);
  readonly units = input.required<Unit[]>();
  readonly previewFirst = input(false);
  readonly selected = signal<Unit | undefined>(undefined);
  readonly qr = signal('');
  readonly feedback = signal('');
  saving = false;
  private renderId = 0;

  constructor() {
    effect(() => {
      const units = this.units();
      const first = this.previewFirst();
      const selected = untracked(this.selected);
      if (selected && units.some(unit => unit.unitId === selected.unitId)) return;
      if (first && units[0]) void this.show(units[0]);
      else this.close();
    });
  }

  async show(unit: Unit) {
    const render = ++this.renderId;
    this.selected.set(unit);
    this.qr.set('');
    this.feedback.set('');
    try {
      const qr = await makeQr(unit.unitId);
      if (render === this.renderId) this.qr.set(qr);
    } catch {
      if (render === this.renderId) this.feedback.set('Could not generate the QR image. Try opening this label again.');
    }
  }

  close() {
    this.renderId++;
    this.selected.set(undefined);
    this.feedback.set('');
  }

  async download() {
    const unit = this.selected();
    const qr = this.qr();
    if (!unit || !qr || this.saving) return;
    const render = this.renderId;
    this.saving = true;
    try {
      const result = await downloadQr(unit.unitId, qr);
      if (render === this.renderId) this.feedback.set(result);
    } catch {
      if (render === this.renderId) this.feedback.set('Could not save the PNG. Check available storage and try again.');
    } finally {
      this.saving = false;
    }
  }
}
