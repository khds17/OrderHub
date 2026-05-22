'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

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
          {status === 'authenticated' && user ? (
            <>
              <Link
                href="/orders"
                className="text-slate-700 hover:text-slate-900"
              >
                My orders
              </Link>
              <Link href="/cart" className="text-slate-700 hover:text-slate-900">
                Cart
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
