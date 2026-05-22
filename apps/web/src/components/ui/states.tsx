import { ApiError } from '@/lib/api-client';
import { Alert } from './alert';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="py-8 text-center text-sm text-slate-500" aria-live="polite">
      {label}
    </p>
  );
}

export function ErrorState({
  error,
  fallback = 'Something went wrong',
}: {
  error: unknown;
  fallback?: string;
}) {
  const message = error instanceof ApiError ? error.message : fallback;
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : undefined;
  return <Alert tone="error" fieldErrors={fieldErrors}>{message}</Alert>;
}
