import { Component, effect, inject, input, signal } from '@angular/core';
import { EquipmentStore } from '../../core/inventory/equipment-store.service';

@Component({
  selector: 'equipment-photo',
  template: `@if (url(); as src) { <img [src]="src" [alt]="name()" (error)="url.set('')"> }
             @else { <span aria-label="Equipment photo unavailable">▧</span> }`,
})
export class EquipmentPhoto {
  readonly key = input.required<string>();
  readonly name = input.required<string>();
  readonly url = signal('');
  private readonly store = inject(EquipmentStore);

  constructor() {
    effect(onCleanup => {
      const key = this.key();
      let active = true;
      let objectUrl = '';
      this.url.set('');
      void this.store.photo(key).then(blob => {
        if (!blob || !active) return;
        objectUrl = URL.createObjectURL(blob);
        this.url.set(objectUrl);
      }).catch(() => { /* The card shows an unavailable photo. */ });
      onCleanup(() => {
        active = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    });
  }
}
