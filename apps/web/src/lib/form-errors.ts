import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, type FieldError } from './api-client';

/**
 * Map server-returned field errors onto a react-hook-form `setError`.
 *
 * The API returns `errors: [{ field, message }]` — surface those on the
 * matching form fields instead of (or in addition to) a single global message.
 */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  err: unknown,
): FieldError[] | undefined {
  if (!(err instanceof ApiError) || !err.fieldErrors) return undefined;
  for (const fe of err.fieldErrors) {
    setError(fe.field as Path<T>, { type: 'server', message: fe.message });
  }
  return err.fieldErrors;
}
