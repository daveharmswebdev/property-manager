import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiClient, LandlordInvitationDto } from '../../../core/api/api.service';

/**
 * Admin Store State (Story 22.4, AC: #3, #5, #6).
 * Manages the platform-admin view of landlord invitations.
 */
type AdminState = {
  invitations: LandlordInvitationDto[];
  loading: boolean;
  error: string | null;
};

const initialState: AdminState = {
  invitations: [],
  loading: false,
  error: null,
};

const SUCCESS_SNACK = {
  duration: 3000,
  horizontalPosition: 'center' as const,
  verticalPosition: 'bottom' as const,
};

const ERROR_SNACK = {
  duration: 5000,
  horizontalPosition: 'center' as const,
  verticalPosition: 'bottom' as const,
};

/**
 * Extracts a human-readable message from an API error, mirroring UserManagementStore.
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  const err = error as { errors?: Record<string, string[]>; title?: string };
  if (err?.errors) {
    const messages = Object.values(err.errors).flat();
    return messages.join('. ');
  }
  if (err?.title) {
    return err.title;
  }
  return fallback;
}

/**
 * AdminStore
 *
 * State management for the admin console's landlord-invitations section.
 * Injects the generated ApiClient directly (no separate admin.service.ts) — the
 * established 19.6/19.7 pattern in UserManagementStore treats the generated client
 * as the service layer.
 */
export const AdminStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiClient), snackBar = inject(MatSnackBar)) => {
    const reloadInvitations = () => {
      api.adminLandlordInvitations_GetLandlordInvitations().subscribe({
        next: (res) => patchState(store, { invitations: res.items ?? [] }),
        error: (err) => console.error('Error reloading landlord invitations:', err),
      });
    };

    return {
      /**
       * Load all landlord invitations (AC: #3).
       */
      loadInvitations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            api.adminLandlordInvitations_GetLandlordInvitations().pipe(
              tap((res) =>
                patchState(store, {
                  invitations: res.items ?? [],
                  loading: false,
                }),
              ),
              catchError((error) => {
                patchState(store, {
                  loading: false,
                  error: 'Failed to load landlord invitations',
                });
                console.error('Error loading landlord invitations:', error);
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /**
       * Create a new landlord invitation (AC: #4, #5).
       */
      createInvitation: rxMethod<{ email: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ email }) =>
            api.adminLandlordInvitations_CreateLandlordInvitation({ email }).pipe(
              tap(() => {
                patchState(store, { loading: false });
                snackBar.open(`Landlord invitation sent to ${email}`, 'Close', SUCCESS_SNACK);
                reloadInvitations();
              }),
              catchError((error) => {
                const errorMessage = extractErrorMessage(
                  error,
                  'Failed to send landlord invitation',
                );
                patchState(store, { loading: false, error: errorMessage });
                snackBar.open(errorMessage, 'Close', ERROR_SNACK);
                console.error('Error sending landlord invitation:', error);
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /**
       * Resend an expired landlord invitation (AC: #6).
       */
      resendInvitation: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((id) =>
            api.adminLandlordInvitations_ResendLandlordInvitation(id).pipe(
              tap(() => {
                patchState(store, { loading: false });
                snackBar.open('Landlord invitation resent successfully', 'Close', SUCCESS_SNACK);
                reloadInvitations();
              }),
              catchError((error) => {
                const errorMessage = extractErrorMessage(
                  error,
                  'Failed to resend landlord invitation',
                );
                patchState(store, { loading: false, error: errorMessage });
                snackBar.open(errorMessage, 'Close', ERROR_SNACK);
                console.error('Error resending landlord invitation:', error);
                return of(null);
              }),
            ),
          ),
        ),
      ),
    };
  }),
);
