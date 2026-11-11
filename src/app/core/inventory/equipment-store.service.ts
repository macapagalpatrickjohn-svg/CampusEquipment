import { Injectable, computed, inject, signal } from '@angular/core';
import { DBSchema, IDBPDatabase, IDBPTransaction, openDB } from 'idb';
import { AdminAccess } from '../admin/admin-access.service';

export interface Equipment {
  itemId: string;
  equipmentName: string;
  equipmentPhoto: string;
  totalQuantity: number;
  createdAt: string;
  archived?: boolean;
}

export interface Unit {
  unitId: string;
  itemId: string;
  number: number;
  retired?: boolean;
}

export interface Loan {
  borrowId: string;
  itemId: string;
  unitId?: string;
  equipmentName: string;
  equipmentPhotoReference: string;
  borrowerName: string;
  studentId: string;
  borrowDate: string;
  returnDate: string;
  status: 'Borrowed' | 'Returned';
  actualReturnDate: string | null;
}

interface CampusDB extends DBSchema {
  equipment: { key: string; value: Equipment };
  photos: { key: string; value: Blob };
  units: { key: string; value: Unit; indexes: { group: string } };
  loans: {
    key: string;
    value: Loan;
    indexes: { 'item-status': [string, Loan['status']]; 'unit-status': [string, Loan['status']] };
  };
}

export function localDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function validReturnDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < today) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function message(error: unknown, fallback: string): string {
  return error instanceof UserError ? error.message : fallback;
}

class UserError extends Error {}

function newUnit(itemId: string, number: number): Unit {
  return { unitId: 'EQ-' + crypto.randomUUID().toUpperCase(), itemId, number };
}

async function migrateUnits(tx: IDBPTransaction<CampusDB, ArrayLike<'equipment' | 'photos' | 'units' | 'loans'>, 'versionchange'>) {
  const loans = tx.objectStore('loans');
  const units = tx.objectStore('units');
  const groups = await tx.objectStore('equipment').getAll();
  for (const item of groups) {
    const active = await loans.index('item-status').getAll([item.itemId, 'Borrowed']);
    active.sort((a, b) => a.borrowDate.localeCompare(b.borrowDate) || a.borrowId.localeCompare(b.borrowId));
    // Keep the former group label as unit 1 and assign existing open loans to distinct units.
    for (let index = 0; index < item.totalQuantity; index++) {
      const unit = index === 0
        ? { unitId: item.itemId, itemId: item.itemId, number: 1 }
        : newUnit(item.itemId, index + 1);
      await units.add(unit);
      if (active[index]) await loans.put({ ...active[index], unitId: unit.unitId });
    }
  }
}

@Injectable({ providedIn: 'root' })
export class EquipmentStore {
  private readonly admin = inject(AdminAccess);
  private connection?: Promise<IDBPDatabase<CampusDB>>;
  private refreshId = 0;
  readonly records = signal<{ equipment: Equipment[]; units: Unit[]; active: Loan[]; history: Loan[] }>({
    equipment: [], units: [], active: [], history: [],
  });
  readonly loading = signal(true);
  readonly error = signal('');
  private readonly unitsByGroup = computed(() => {
    const groups = new Map<string, Unit[]>();
    for (const unit of this.records().units) {
      const group = groups.get(unit.itemId);
      if (group) group.push(unit);
      else groups.set(unit.itemId, [unit]);
    }
    return groups;
  });
  private readonly borrowedUnits = computed(() => new Set(this.records().active.map(loan => loan.unitId)));

  private db() {
    this.connection ??= openDB<CampusDB>('campus-equipment', 2, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion === 0) {
          db.createObjectStore('equipment', { keyPath: 'itemId' });
          db.createObjectStore('photos');
          db.createObjectStore('loans', { keyPath: 'borrowId' }).createIndex('item-status', ['itemId', 'status']);
        }
        db.createObjectStore('units', { keyPath: 'unitId' }).createIndex('group', 'itemId');
        tx.objectStore('loans').createIndex('unit-status', ['unitId', 'status'], { unique: false });
        if (oldVersion === 1) void migrateUnits(tx).catch(() => {
          // A failed migration must leave the original database intact.
          void tx.done.catch(() => {});
          try { tx.abort(); } catch { /* The transaction has already aborted. */ }
        });
      },
      blocked: () => this.error.set('Close other Campus Equipment windows, then retry opening local records.'),
      blocking: (_current, _next, event) => {
        (event.target as IDBDatabase).close();
        this.connection = undefined;
      },
    }).catch(error => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }

  async refresh() {
    const refreshId = ++this.refreshId;
    try {
      const tx = (await this.db()).transaction(['equipment', 'units', 'loans']);
      const [equipment, units, loans] = await Promise.all([
        tx.objectStore('equipment').getAll(), tx.objectStore('units').getAll(), tx.objectStore('loans').getAll(), tx.done,
      ]);
      if (refreshId !== this.refreshId) return;
      const visible = equipment.filter(item => !item.archived).sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));
      const visibleIds = new Set(visible.map(item => item.itemId));
      const active = loans.filter(loan => loan.status === 'Borrowed')
        .sort((a, b) => a.returnDate.localeCompare(b.returnDate) || a.borrowDate.localeCompare(b.borrowDate));
      const history = loans.filter(loan => loan.status === 'Returned')
        .sort((a, b) => (b.actualReturnDate ?? b.borrowDate).localeCompare(a.actualReturnDate ?? a.borrowDate));
      this.records.set({
        equipment: visible, units: units.filter(unit => !unit.retired && visibleIds.has(unit.itemId))
          .sort((a, b) => a.number - b.number),
        active, history,
      });
      this.error.set('');
    } catch {
      if (refreshId === this.refreshId) this.error.set('Could not open local records. Try loading them again.');
    } finally {
      if (refreshId === this.refreshId) this.loading.set(false);
    }
  }

  unitsFor(itemId: string) {
    return this.unitsByGroup().get(itemId) ?? [];
  }

  isBorrowed(unitId: string): boolean {
    return this.borrowedUnits().has(unitId);
  }

  available(item: Equipment): number {
    return this.unitsFor(item.itemId).filter(unit => !this.isBorrowed(unit.unitId)).length;
  }

  async photo(key: string) {
    return (await this.db()).get('photos', key);
  }

  async save(itemId: string | null, name: string, quantity: number | null, photo?: Blob) {
    this.requireAdmin();
    const equipmentName = name.trim();
    if (!equipmentName || equipmentName.length > 100) throw new UserError('Enter an equipment name of up to 100 characters.');
    if (quantity === null || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new UserError('Enter a whole quantity from 1 to 500.');
    }
    if ((!itemId || photo) && (!photo?.size || photo.type !== 'image/jpeg')) {
      throw new UserError('Choose an equipment photo first.');
    }

    const tx = (await this.db()).transaction(['equipment', 'photos', 'units', 'loans'], 'readwrite');
    const equipment = tx.objectStore('equipment');
    const units = tx.objectStore('units');
    const id = itemId ?? crypto.randomUUID();
    const [previous, allUnits, loans] = await Promise.all([
      equipment.get(id), units.index('group').getAll(id),
      tx.objectStore('loans').index('item-status').getAll([id, 'Borrowed']),
    ]);
    if (itemId && (!previous || previous.archived)) throw new UserError('This equipment has been deleted.');
    const checkedOut = new Set(loans.map(loan => loan.unitId));
    if (quantity < checkedOut.size) throw new UserError('Return borrowed units before reducing stock below the number on loan.');
    const live = allUnits.filter(unit => !unit.retired);
    const removed = live.filter(unit => !checkedOut.has(unit.unitId))
      .sort((a, b) => b.number - a.number).slice(0, Math.max(0, live.length - quantity));
    const lastNumber = allUnits.reduce((highest, unit) => Math.max(highest, unit.number), 0);
    const added = Array.from({ length: Math.max(0, quantity - live.length) }, (_, index) => newUnit(id, lastNumber + index + 1));
    const equipmentPhoto = photo ? crypto.randomUUID() : previous!.equipmentPhoto;
    const item: Equipment = {
      itemId: id, equipmentName, equipmentPhoto, totalQuantity: quantity,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
    };

    // Save the group, photo, and unit changes together. Existing loans keep their original photo reference.
    await Promise.all([
      itemId ? equipment.put(item) : equipment.add(item),
      ...(photo ? [tx.objectStore('photos').add(photo, equipmentPhoto)] : []),
      ...removed.map(unit => units.put({ ...unit, retired: true })),
      ...added.map(unit => units.add(unit)),
      tx.done,
    ]);
    await this.refresh();
    return item;
  }

  async delete(itemId: string) {
    this.requireAdmin();
    const tx = (await this.db()).transaction(['equipment', 'loans'], 'readwrite');
    const equipment = tx.objectStore('equipment');
    const [item, active] = await Promise.all([
      equipment.get(itemId),
      tx.objectStore('loans').index('item-status').count([itemId, 'Borrowed']),
    ]);
    if (!item || item.archived) throw new UserError('This equipment has already been deleted.');
    if (active) throw new UserError('Return all borrowed units before deleting this equipment.');
    // Keep loan history and its photo snapshots readable after deletion.
    await Promise.all([equipment.put({ ...item, archived: true }), tx.done]);
    await this.refresh();
  }

  private requireAdmin() {
    if (!this.admin.unlocked()) throw new UserError('Enter the admin PIN to manage equipment.');
  }

  async find(rawId: string): Promise<{ item: Equipment; unit: Unit }> {
    const unitId = rawId.trim().toUpperCase();
    if (!/^EQ-[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(unitId)) {
      throw new UserError('Use a Campus Equipment QR code or enter a full Unit ID from Inventory.');
    }
    const tx = (await this.db()).transaction(['equipment', 'units']);
    const unit = await tx.objectStore('units').get(unitId);
    const item = unit && await tx.objectStore('equipment').get(unit.itemId);
    if (!unit || unit.retired || !item || item.archived) {
      throw new UserError('This Unit ID is not in the current inventory.');
    }
    return { item, unit };
  }

  async borrow(unitId: string, name: string, id: string, returnDate: string, borrowId: string) {
    const borrowerName = name.trim();
    const studentId = id.trim();
    if (!borrowerName || borrowerName.length > 100) throw new UserError('Enter a borrower name of up to 100 characters.');
    if (!studentId || studentId.length > 40) throw new UserError('Enter a student ID of up to 40 characters.');
    const now = new Date();
    if (!validReturnDate(returnDate, localDate(now))) throw new UserError('Choose a valid return date of today or later.');

    // Check and write the specific unit in one transaction, even when multiple requests arrive together.
    const tx = (await this.db()).transaction(['equipment', 'units', 'loans'], 'readwrite');
    const loans = tx.objectStore('loans');
    const [unit, active, existing] = await Promise.all([
      tx.objectStore('units').get(unitId),
      loans.index('unit-status').count([unitId, 'Borrowed']),
      loans.get(borrowId),
    ]);
    if (existing) throw new UserError('This borrowing request has already been saved.');
    const item = unit && await tx.objectStore('equipment').get(unit.itemId);
    if (!unit || unit.retired || !item || item.archived) throw new UserError('This unit is no longer in the inventory.');
    if (active) throw new UserError('This unit is already on loan. Choose an available unit.');

    await Promise.all([loans.add({
      borrowId, unitId, itemId: item.itemId, equipmentName: item.equipmentName, equipmentPhotoReference: item.equipmentPhoto,
      borrowerName, studentId, borrowDate: now.toISOString(), returnDate,
      status: 'Borrowed', actualReturnDate: null,
    }), tx.done]);
    await this.refresh();
  }

  async returnLoan(borrowId: string) {
    const tx = (await this.db()).transaction('loans', 'readwrite');
    const loan = await tx.store.get(borrowId);
    if (!loan || loan.status !== 'Borrowed') throw new UserError('This loan has already been closed or could not be found.');
    await Promise.all([tx.store.put({
      ...loan, status: 'Returned', actualReturnDate: new Date().toISOString(),
    }), tx.done]);
    await this.refresh();
  }
}
