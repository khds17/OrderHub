'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CardSchema,
  ChangePasswordSchema,
  UpdateUserSchema,
  type CardInput,
  type ChangePasswordInput,
  type PaymentMethod,
  type UpdateUserInput,
  type User,
} from '@orderhub/contracts';
import { AuthGuard } from '@/components/auth-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useAuth } from '@/features/auth/use-auth';
import {
  useChangePassword,
  useDeletePaymentMethod,
  usePaymentMethod,
  useSavePaymentMethod,
  useUpdateMe,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileInner />
    </AuthGuard>
  );
}

function ProfileInner() {
  const user = useAuth((s) => s.user);
  if (!user) {
    // AuthGuard handles unauth redirect; this is the brief in-flight gap.
    return <LoadingState />;
  }
  return (
    <section className="mx-auto max-w-2xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-slate-500">
          Signed in as <span className="font-mono">{user.email}</span>
        </p>
      </header>
      <PersonalInfoSection user={user} />
      <SavedCardSection />
      <ChangePasswordSection />
    </section>
  );
}

// ── Personal info ──────────────────────────────────────────────────────────

function PersonalInfoSection({ user }: { user: User }) {
  const update = useUpdateMe();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: user.name,
      // RHF treats undefined/null defaults inconsistently across input types;
      // coerce to empty strings for the inputs, then back on submit.
      surname: user.surname ?? '',
      address: user.address ?? '',
    },
  });

  // If the user object updates from elsewhere (e.g. another tab), reset the
  // form back to the canonical values so we don't show stale data.
  useEffect(() => {
    reset({
      name: user.name,
      surname: user.surname ?? '',
      address: user.address ?? '',
    });
  }, [user.name, user.surname, user.address, reset]);

  async function onSubmit(values: UpdateUserInput) {
    try {
      await update.mutateAsync({
        name: values.name,
        // Treat empty strings as "clear" → send null so the column gets set
        // back to NULL rather than to the empty string.
        surname:
          typeof values.surname === 'string' && values.surname.trim().length === 0
            ? null
            : values.surname,
        address:
          typeof values.address === 'string' && values.address.trim().length === 0
            ? null
            : values.address,
      });
      setSavedAt(Date.now());
    } catch (err) {
      const handled = applyServerErrors(setError, err);
      if (!handled) {
        setError('root', {
          message:
            err instanceof ApiError ? err.message : 'Something went wrong',
        });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.message });
      }
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <h2 className="text-lg font-semibold">Personal info</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Name"
              id="profile-name"
              autoComplete="given-name"
              error={errors.name?.message}
              {...register('name')}
            />
            <FormField
              label="Surname"
              id="profile-surname"
              autoComplete="family-name"
              error={errors.surname?.message}
              {...register('surname')}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="profile-address"
              className="block text-sm font-medium text-slate-800"
            >
              Address
            </label>
            <Textarea
              id="profile-address"
              rows={2}
              autoComplete="street-address"
              placeholder="Optional"
              {...register('address')}
            />
            {errors.address?.message ? (
              <p className="text-xs text-red-600">{errors.address.message}</p>
            ) : null}
          </div>
          {errors.root?.message ? (
            <Alert tone="error">{errors.root.message}</Alert>
          ) : null}
          {savedAt && !isDirty ? (
            <Alert tone="success" role="status">
              Profile saved.
            </Alert>
          ) : null}
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ── Saved card ─────────────────────────────────────────────────────────────

function SavedCardSection() {
  const { data, isLoading, error } = usePaymentMethod();
  const save = useSavePaymentMethod();
  const remove = useDeletePaymentMethod();
  const [editing, setEditing] = useState(false);

  const paymentMethod = data?.paymentMethod ?? null;

  // When the saved card arrives or changes, fold the editor closed unless the
  // user just opened it explicitly. Otherwise saving would leave the form
  // sitting open with stale values.
  useEffect(() => {
    if (paymentMethod && !save.isPending) setEditing(false);
  }, [paymentMethod, save.isPending]);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Saved card</h2>
            <p className="text-sm text-slate-500">
              A mock card kept on file for faster checkout. We store only the
              last four digits.
            </p>
          </div>
          {paymentMethod ? (
            <Badge tone="success">On file</Badge>
          ) : (
            <Badge tone="neutral">None</Badge>
          )}
        </div>

        {error ? (
          <ErrorState error={error} fallback="Failed to load saved card" />
        ) : isLoading ? (
          <LoadingState />
        ) : paymentMethod && !editing ? (
          <SavedCardDisplay
            method={paymentMethod}
            onReplace={() => setEditing(true)}
            onRemove={() => remove.mutate()}
            removing={remove.isPending}
            removeError={remove.error}
          />
        ) : (
          <SavedCardForm
            initialHolder={paymentMethod?.holderName}
            saving={save.isPending}
            saveError={save.error}
            onCancel={
              paymentMethod ? () => setEditing(false) : undefined
            }
            onSubmit={(card) => save.mutate(card)}
          />
        )}
      </CardBody>
    </Card>
  );
}

function SavedCardDisplay({
  method,
  onReplace,
  onRemove,
  removing,
  removeError,
}: {
  method: PaymentMethod;
  onReplace: () => void;
  onRemove: () => void;
  removing: boolean;
  removeError: unknown;
}) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="font-medium">Cardholder</dt>
          <dd>{method.holderName}</dd>
        </div>
        <div>
          <dt className="font-medium">Number</dt>
          <dd className="font-mono">•••• {method.last4}</dd>
        </div>
        <div>
          <dt className="font-medium">Expires</dt>
          <dd>{method.expiry}</dd>
        </div>
      </dl>
      {removeError ? (
        <Alert tone="error">
          {removeError instanceof ApiError
            ? removeError.message
            : 'Failed to remove card'}
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onReplace}>
          Replace
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={removing}
          onClick={() => {
            if (window.confirm('Remove the saved card?')) onRemove();
          }}
        >
          {removing ? 'Removing…' : 'Remove'}
        </Button>
      </div>
    </div>
  );
}

function SavedCardForm({
  initialHolder,
  saving,
  saveError,
  onCancel,
  onSubmit,
}: {
  initialHolder?: string;
  saving: boolean;
  saveError: unknown;
  onCancel?: () => void;
  onSubmit: (card: CardInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CardInput>({
    resolver: zodResolver(CardSchema),
    defaultValues: {
      number: '',
      holderName: initialHolder ?? '',
      expiry: '',
      cvv: '',
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3"
      noValidate
      aria-label="Save card"
    >
      <Alert tone="info">
        Mock card data — never charged. Only the last four digits are stored.
      </Alert>
      <FormField
        label="Card number"
        id="saved-card-number"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="4111 1111 1111 1111"
        error={errors.number?.message}
        {...register('number', {
          setValueAs: (v: string) => (v ?? '').replace(/\s+/g, ''),
        })}
      />
      <FormField
        label="Cardholder name"
        id="saved-card-holder"
        autoComplete="cc-name"
        error={errors.holderName?.message}
        {...register('holderName')}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Expiry (MM/YY)"
          id="saved-card-expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="12/29"
          error={errors.expiry?.message}
          {...register('expiry')}
        />
        <FormField
          label="CVV"
          id="saved-card-cvv"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          error={errors.cvv?.message}
          {...register('cvv')}
        />
      </div>
      {saveError ? (
        <Alert tone="error">
          {saveError instanceof ApiError
            ? saveError.message
            : 'Failed to save card'}
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save card'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// ── Change password ───────────────────────────────────────────────────────

function ChangePasswordSection() {
  const change = useChangePassword();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function onSubmit(values: ChangePasswordInput) {
    try {
      await change.mutateAsync(values);
      reset({ currentPassword: '', newPassword: '' });
      setSavedAt(Date.now());
    } catch (err) {
      const handled = applyServerErrors(setError, err);
      if (!handled) {
        setError('root', {
          message:
            err instanceof ApiError ? err.message : 'Something went wrong',
        });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.message });
      }
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <h2 className="text-lg font-semibold">Change password</h2>
          <FormField
            label="Current password"
            id="current-password"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <FormField
            label="New password"
            id="new-password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, must differ from current."
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          {errors.root?.message ? (
            <Alert tone="error">{errors.root.message}</Alert>
          ) : null}
          {savedAt ? (
            <Alert tone="success" role="status">
              Password updated. Other sessions have been signed out.
            </Alert>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
