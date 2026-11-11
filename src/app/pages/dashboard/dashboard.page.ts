import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { EquipmentStore } from '../../core/inventory/equipment-store.service';

@Component({ imports: [RouterLink, IonIcon], templateUrl: './dashboard.page.html' })
export class Dashboard {
  private readonly store = inject(EquipmentStore);
  readonly totals = computed(() => {
    const { equipment, active } = this.store.records();
    const units = equipment.reduce((sum, item) => sum + item.totalQuantity, 0);
    return { types: equipment.length, units, borrowed: active.length, available: units - active.length, share: units ? (units - active.length) / units * 100 : 0 };
  });
}
