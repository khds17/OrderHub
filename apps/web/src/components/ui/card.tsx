import * as React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...rest }: Props) {
  const cls = [
    'rounded-lg border border-slate-200 bg-white shadow-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={cls} {...rest} />;
}

export function CardBody({ className, ...rest }: Props) {
  const cls = ['p-4', className].filter(Boolean).join(' ');
  return <div className={cls} {...rest} />;
}
