import { Routes } from '@angular/router';
import { authGuard, guestGuard, publicGuard } from './core/auth/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  // Public auth routes (AC7.6)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
    canActivate: [publicGuard],
  },
  {
    path: 'accept-invitation',
    loadComponent: () =>
      import('./features/auth/accept-invitation/accept-invitation.component').then(
        (m) => m.AcceptInvitationComponent
      ),
    canActivate: [publicGuard],
  },

  // Protected routes wrapped in Shell layout (AC7.6, AC7.7)
  {
    path: '',
    loadComponent: () =>
      import('./core/components/shell/shell.component').then(
        (m) => m.ShellComponent
      ),
    canActivate: [authGuard],
    children: [
      // Dashboard (AC7.7) - default route
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      // Properties (AC7.7, AC-2.1.1)
      {
        path: 'properties',
        loadComponent: () =>
          import('./features/properties/properties.component').then(
            (m) => m.PropertiesComponent
          ),
      },
      {
        path: 'properties/new',
        loadComponent: () =>
          import('./features/properties/property-form/property-form.component').then(
            (m) => m.PropertyFormComponent
          ),
      },
      // Property Detail (AC-2.3.1)
      {
        path: 'properties/:id',
        loadComponent: () =>
          import('./features/properties/property-detail/property-detail.component').then(
            (m) => m.PropertyDetailComponent
          ),
      },
      // Property Edit (AC-2.4.1, AC-2.4.3)
      {
        path: 'properties/:id/edit',
        loadComponent: () =>
          import('./features/properties/property-edit/property-edit.component').then(
            (m) => m.PropertyEditComponent
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      // Property Expense Workspace (AC-3.1.1)
      {
        path: 'properties/:id/expenses',
        loadComponent: () =>
          import('./features/expenses/expense-workspace/expense-workspace.component').then(
            (m) => m.ExpenseWorkspaceComponent
          ),
      },
      // Property Income Workspace (AC-4.1.1)
      {
        path: 'properties/:id/income',
        loadComponent: () =>
          import('./features/income/income-workspace/income-workspace.component').then(
            (m) => m.IncomeWorkspaceComponent
          ),
      },
      // Expenses (AC7.7)
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expenses.component').then(
            (m) => m.ExpensesComponent
          ),
      },
      // Expense Detail (AC-15.5.1)
      {
        path: 'expenses/:id',
        loadComponent: () =>
          import('./features/expenses/expense-detail/expense-detail.component').then(
            (m) => m.ExpenseDetailComponent
          ),
      },
      // Income (AC7.7)
      {
        path: 'income',
        loadComponent: () =>
          import('./features/income/income.component').then(
            (m) => m.IncomeComponent
          ),
      },
      // Receipts (AC7.7)
      {
        path: 'receipts',
        loadComponent: () =>
          import('./features/receipts/receipts.component').then(
            (m) => m.ReceiptsComponent
          ),
      },
      // Receipt Processing (AC-5.4.1)
      {
        path: 'receipts/:id',
        loadComponent: () =>
          import('./features/receipts/receipt-process/receipt-process.component').then(
            (m) => m.ReceiptProcessComponent
          ),
      },
      // Reports (AC7.7)
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(
            (m) => m.ReportsComponent
          ),
      },
      // Settings (AC7.7)
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },
      // Vendors (Story 8.3 - AC #1)
      {
        path: 'vendors',
        loadComponent: () =>
          import('./features/vendors/vendors.component').then(
            (m) => m.VendorsComponent
          ),
      },
      {
        path: 'vendors/new',
        loadComponent: () =>
          import('./features/vendors/components/vendor-form/vendor-form.component').then(
            (m) => m.VendorFormComponent
          ),
      },
      // Vendor Detail (Story 8.9 - AC #1)
      {
        path: 'vendors/:id',
        loadComponent: () =>
          import('./features/vendors/components/vendor-detail/vendor-detail.component').then(
            (m) => m.VendorDetailComponent
          ),
      },
      // Vendor Edit (Story 8.4 - AC #1, Story 8.7 - AC #4, #5, Story 8.9 - AC #6)
      {
        path: 'vendors/:id/edit',
        loadComponent: () =>
          import('./features/vendors/components/vendor-edit/vendor-edit.component').then(
            (m) => m.VendorEditComponent
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      // Work Orders (Story 9.2 - AC #6)
      {
        path: 'work-orders',
        loadComponent: () =>
          import('./features/work-orders/work-orders.component').then(
            (m) => m.WorkOrdersComponent
          ),
      },
      {
        path: 'work-orders/new',
        loadComponent: () =>
          import('./features/work-orders/pages/work-order-create/work-order-create.component').then(
            (m) => m.WorkOrderCreateComponent
          ),
      },
      {
        path: 'work-orders/:id',
        loadComponent: () =>
          import('./features/work-orders/pages/work-order-detail/work-order-detail.component').then(
            (m) => m.WorkOrderDetailComponent
          ),
      },
      // Work Order Edit (Story 9-9, AC #1)
      {
        path: 'work-orders/:id/edit',
        loadComponent: () =>
          import('./features/work-orders/pages/work-order-edit/work-order-edit.component').then(
            (m) => m.WorkOrderEditComponent
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      // Default child redirect to dashboard
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },

  // Catch-all redirect to dashboard
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
