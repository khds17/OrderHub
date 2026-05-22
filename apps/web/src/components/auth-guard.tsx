'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { UserRole } from '@orderhub/contracts';
import { useAuth } from '@/features/auth/use-auth';

type Props = {
  children: React.ReactNode;
  /** If provided, the user must have one of these roles. */
  roles?: UserRole[];
};

export function AuthGuard({ children, roles }: Props) {
  const router = useRouter();
  const { user, status, init } = useAuth();

  useEffect(() => {
    if (status === 'idle') void init();
  }, [status, init]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (
      status === 'authenticated' &&
      user &&
      roles &&
      !roles.includes(user.role)
    ) {
      router.replace('/');
    }
  }, [status, user, roles, router]);

  // Happy path — render immediately when authenticated.
  if (status === 'authenticated' && user && (!roles || roles.includes(user.role))) {
    return <>{children}</>;
  }

  // We have a token but haven't validated it yet — render children
  // optimistically. If the access token is stale, the api-client will
  // transparently refresh it; if refresh fails, the auth-failure callback
  // kicks the user out. This avoids the "Checking access…" flicker on every
  // page navigation.
  if (status === 'loading' && user) {
    return <>{children}</>;
  }

  return (
    <div
      className="py-12 text-center text-sm text-slate-500"
      aria-live="polite"
    >
      Checking access…
    </div>
  );
}
