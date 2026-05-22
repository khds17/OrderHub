import * as React from 'react';
import { Input } from './input';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
  hint?: string;
};

export const FormField = React.forwardRef<HTMLInputElement, Props>(
  function FormField({ label, id, error, hint, ...rest }, ref) {
    const describedBy =
      [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
        .filter(Boolean)
        .join(' ') || undefined;
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-slate-800">
          {label}
        </label>
        <Input
          ref={ref}
          id={id}
          invalid={Boolean(error)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {hint && !error ? (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
