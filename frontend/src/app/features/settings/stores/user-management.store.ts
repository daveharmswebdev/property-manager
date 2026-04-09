import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ApiClient,
  InvitationDto,
  AccountUserDto,
  CreateInvitationRequest,
} from '../../../core/api/api.service';

/**
 * UserManagement Store State (AC: #1, #2, #3, #4)
 */
type UserManagementState = {
  invitations: InvitationDto[];
  users: AccountUserDto[];
  loading: boolean;
  error: string | null;
};

const initialState: UserManagementState = {
  invitations: [],
  users: [],
  loading: false,
  error: null,
};

/**
 * UserManagementStore
 *
 * State management for invitation and user management in Settings.
 */
export const UserManagementStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiClient), snackBar = inject(MatSnackBar)) => {
    // Helper to reload invitations into state
    const reloadInvitations = () => {
      api.invitations_GetAccountInvitations().subscribe({
        next: (res) => patchState(store, { invitations: res.items ?? [] }),
        error: (err) => console.error('Error reloading invitations:', err),
      });
    };

    return {
      /**
       * Load invitations for the current account (AC: #3)
       */
      loadInvitations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            api.invitations_GetAccountInvitations().pipe(
              tap((res) =>
                patchState(store, {
                  invitations: res.items ?? [],
                  loading: false,
                }),
              ),
              catchError((error) => {
                patchState(store, { loading: false, error: 'Failed to load invitations' });
                console.error('Error loading invitations:', error);
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /**
       * Load account users (AC: #7)
       */
      loadUsers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            api.accountUsers_GetAccountUsers().pipe(
              tap((res) =>
                patchState(store, {
                  users: res.items ?? [],
                  loading: false,
                }),
              ),
              catchError((error) => {
                patchState(store, { loading: false, error: 'Failed to load users' });
                console.error('Error loading users:', error);
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /**
       * Send a new invitation (AC: #2)
       */
      sendInvitation: rxMethod<{ email: string; role: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ email, role }) =>
            api
              .invitations_CreateInvitation({ email, role } as CreateInvitationRequest)
              .pipe(
                tap(() => {
                  patchState(store, { loading: false });
                  snackBar.open(`Invitation sent to ${email}`, 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom',
                  });
                  reloadInvitations();
                }),
                catchError((error) => {
                  let errorMessage = 'Failed to send invitation';
                  if (error?.errors) {
                    const messages = Object.values(error.errors).flat();
                    errorMessage = (messages as string[]).join('. ');
                  } else if (error?.title) {
                    errorMessage = error.title;
                  }
                  patchState(store, { loading: false, error: errorMessage });
                  snackBar.open(errorMessage, 'Close', {
                    duration: 5000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom',
                  });
                  console.error('Error sending invitation:', error);
                  return of(null);
                }),
              ),
          ),
        ),
      ),

      /**
       * Resend an expired invitation (AC: #4)
       */
      resendInvitation: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((id) =>
            api.invitations_ResendInvitation(id).pipe(
              tap(() => {
                patchState(store, { loading: false });
                snackBar.open('Invitation resent successfully', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                reloadInvitations();
              }),
              catchError((error) => {
                const errorMessage = 'Failed to resend invitation';
                patchState(store, { loading: false, error: errorMessage });
                snackBar.open(errorMessage, 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error resending invitation:', error);
                return of(null);
              }),
            ),
          ),
        ),
      ),
    };
  }),
);
