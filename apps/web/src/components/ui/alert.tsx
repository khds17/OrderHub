import * as React from 'react';
import type { FieldError } from '@/lib/api-client';

type Tone = 'error' | 'info' | 'success';

const tones: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  title?: string;
  fieldErrors?: FieldError[];
};

export function Alert({
  tone = 'error',
  title,
  fieldErrors,
  children,
  className,
  ...rest
}: Props) {
  const cls = [
    'rounded-md border p-3 text-sm',
    tones[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div role="alert" className={cls} {...rest}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children}
      {fieldErrors && fieldErrors.length > 0 ? (
        <ul className="mt-1 list-disc pl-5">
          {fieldErrors.map((fe, idx) => (
            <li key={idx}>
              <span className="font-mono">{fe.field}</span>: {fe.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
