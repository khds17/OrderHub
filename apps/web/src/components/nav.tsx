'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { useCart } from '@/features/cart/use-cart';

export function Nav() {
  const { user, status, init, logout } = useAuth();

  useEffect(() => {
    if (status === 'idle') void init();
  }, [status, init]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          OrderHub
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/products" className="text-slate-700 hover:text-slate-900">
            Products
          </Link>
          <CartLink />
          {status === 'authenticated' && user ? (
            <>
              <Link
                href="/orders"
                className="text-slate-700 hover:text-slate-900"
              >
                My orders
              </Link>
              <Link
                href="/profile"
                className="text-slate-700 hover:text-slate-900"
              >
                Profile
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  href="/admin/products"
                  className="text-slate-700 hover:text-slate-900"
                >
                  Admin
                </Link>
              )}
              <span className="hidden text-slate-500 sm:inline">
                {user.email}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void logout()}
              >
                Sign out
              </Button>
            </>
          ) : status === 'unauthenticated' ? (
            <>
              <Link
                href="/login"
                className="text-slate-700 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link href="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

/**
 * Cart link with a quantity-summed badge. The badge only renders after
 * client-side hydration so the localStorage-backed count doesn't trigger
 * a hydration mismatch against the SSR'd value of 0.
 */
function CartLink() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const count = useCart((s) =>
    s.items.reduce((n, item) => n + item.quantity, 0),
  );
  const showBadge = hydrated && count > 0;

  return (
    <Link
      href="/cart"
      className="relative text-slate-700 hover:text-slate-900"
      aria-label={
        showBadge ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'
      }
    >
      Cart
      {showBadge ? (
        <span
          className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-medium text-white"
          aria-hidden="true"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
