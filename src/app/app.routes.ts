import { Routes } from '@angular/router';
import { requireAdmin } from './core/admin/admin-access.service';
import { AddEquipment } from './pages/add-equipment/add-equipment.page';
import { AdminPage } from './pages/admin/admin.page';
import { BorrowEquipment } from './pages/borrow/borrow.page';
import { Dashboard } from './pages/dashboard/dashboard.page';
import { Inventory } from './pages/inventory/inventory.page';
import { BorrowedEquipment } from './pages/loans/loans.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: Dashboard, title: 'Home | Campus Equipment' },
  { path: 'admin', component: AdminPage, title: 'Admin | Campus Equipment' },
  { path: 'inventory/:itemId/edit', component: AddEquipment, canActivate: [requireAdmin], title: 'Edit Equipment | Campus Equipment' },
  { path: 'add', component: AddEquipment, canActivate: [requireAdmin], title: 'Add Equipment | Campus Equipment' },
  { path: 'inventory', component: Inventory, title: 'Inventory | Campus Equipment' },
  { path: 'borrow', component: BorrowEquipment, title: 'Borrow Equipment | Campus Equipment' },
  { path: 'loans', component: BorrowedEquipment, title: 'Borrowed Equipment | Campus Equipment' },
  { path: '**', redirectTo: '' },
];
