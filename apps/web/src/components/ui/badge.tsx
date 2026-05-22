import * as React from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-indigo-100 text-indigo-700',
};

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ tone = 'neutral', className, ...rest }: Props) {
  const cls = [
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    tones[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={cls} {...rest} />;
}
