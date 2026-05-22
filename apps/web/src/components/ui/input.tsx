import * as React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const base =
  'block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500';

export const Input = React.forwardRef<HTMLInputElement, Props>(
  function Input({ className, invalid, ...rest }, ref) {
    const cls = [
      base,
      invalid ? 'border-red-400' : 'border-slate-300',
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return <input ref={ref} className={cls} {...rest} />;
  },
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...rest }, ref) {
    const cls = [
      base,
      invalid ? 'border-red-400' : 'border-slate-300',
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return <textarea ref={ref} className={cls} {...rest} />;
  },
);
