import { Injectable, signal } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';

export interface Equipment {
  itemId: string;
  equipmentName: string;
  equipmentPhoto: string;
  totalQuantity: number;
  createdAt: string;
}

export interface Loan {
  borrowId: string;
  itemId: string;
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
  loans: {
    key: string;
    value: Loan;
    indexes: { 'item-status': [string, Loan['status']] };
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

@Injectable({ providedIn: 'root' })
export class EquipmentStore {
  private connection?: Promise<IDBPDatabase<CampusDB>>;
  private refreshId = 0;
  readonly records = signal<{ equipment: Equipment[]; active: Loan[] }>({ equipment: [], active: [] });
  readonly loading = signal(true);
  readonly error = signal('');

  private db() {
    this.connection ??= openDB<CampusDB>('campus-equipment', 1, {
      upgrade(db) {
        db.createObjectStore('equipment', { keyPath: 'itemId' });
        db.createObjectStore('photos');
        db.createObjectStore('loans', { keyPath: 'borrowId' })
          .createIndex('item-status', ['itemId', 'status']);
      },
      blocking(_current, _next, event) {
        (event.target as IDBDatabase).close();
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
      const tx = (await this.db()).transaction(['equipment', 'loans']);
      const [equipment, loans] = await Promise.all([
        tx.objectStore('equipment').getAll(), tx.objectStore('loans').getAll(), tx.done,
      ]);
      if (refreshId !== this.refreshId) return;
      equipment.sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));
      const active = loans.filter(loan => loan.status === 'Borrowed')
        .sort((a, b) => a.returnDate.localeCompare(b.returnDate) || a.borrowDate.localeCompare(b.borrowDate));
      this.records.set({ equipment, active });
      this.error.set('');
    } catch {
      if (refreshId === this.refreshId) this.error.set('Could not open local records. Try loading them again.');
    } finally {
      if (refreshId === this.refreshId) this.loading.set(false);
    }
  }

  available(item: Equipment): number {
    const active = this.records().active.filter(loan => loan.itemId === item.itemId);
    return item.totalQuantity - active.length;
  }

  async photo(key: string) {
    return (await this.db()).get('photos', key);
  }

  async add(name: string, quantity: number | null, photo: Blob | undefined) {
    const equipmentName = name.trim();
    if (!equipmentName || equipmentName.length > 100) throw new UserError('Enter an equipment name of up to 100 characters.');
    if (quantity === null || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new UserError('Quantity must be a positive whole number.');
    }
    if (!photo?.size || photo.type !== 'image/jpeg') throw new UserError('Choose an equipment photo first.');

    const itemId = 'EQ-' + crypto.randomUUID().toUpperCase();
    const item: Equipment = {
      itemId, equipmentName, equipmentPhoto: itemId,
      totalQuantity: quantity, createdAt: new Date().toISOString(),
    };
    const tx = (await this.db()).transaction(['equipment', 'photos'], 'readwrite');
    // Commit the image and its record together, so neither can be saved alone.
    await Promise.all([
      tx.objectStore('equipment').add(item), tx.objectStore('photos').add(photo, itemId), tx.done,
    ]);
    await this.refresh();
    return item;
  }

  async find(rawId: string): Promise<Equipment> {
    const itemId = rawId.trim().toUpperCase();
    if (!/^EQ-[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(itemId)) {
      throw new UserError('Use a Campus Equipment QR code or enter the full Item ID from Inventory.');
    }
    const item = await (await this.db()).get('equipment', itemId);
    if (!item) throw new UserError('That Item ID is not registered on this device.');
    return item;
  }

  async borrow(itemId: string, name: string, id: string, returnDate: string, borrowId: string) {
    const borrowerName = name.trim();
    const studentId = id.trim();
    if (!borrowerName || borrowerName.length > 100) throw new UserError('Enter a borrower name of up to 100 characters.');
    if (!studentId || studentId.length > 40) throw new UserError('Enter a student ID of up to 40 characters.');
    const now = new Date();
    if (!validReturnDate(returnDate, localDate(now))) throw new UserError('Choose a valid return date of today or later.');

    // Read the stock and write the loan in the same transaction to prevent overbooking.
    const tx = (await this.db()).transaction(['equipment', 'loans'], 'readwrite');
    const loans = tx.objectStore('loans');
    const [item, active, existing] = await Promise.all([
      tx.objectStore('equipment').get(itemId),
      loans.index('item-status').count([itemId, 'Borrowed']),
      loans.get(borrowId),
    ]);
    if (existing) throw new UserError('This borrowing request has already been saved.');
    if (!item) throw new UserError('This equipment is no longer available in Inventory.');
    if (active >= item.totalQuantity) throw new UserError('All units are currently borrowed.');

    await Promise.all([loans.add({
      borrowId, itemId, equipmentName: item.equipmentName, equipmentPhotoReference: item.equipmentPhoto,
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