import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500';

const variants: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  destructive:
    'border border-red-300 bg-white text-red-600 hover:bg-red-50',
  ghost:
    'text-slate-700 hover:bg-slate-100',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  function Button({ className, variant = 'primary', size = 'md', ...rest }, ref) {
    const cls = [base, variants[variant], sizes[size], className]
      .filter(Boolean)
      .join(' ');
    return <button ref={ref} className={cls} {...rest} />;
  },
);
