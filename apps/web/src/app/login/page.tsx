'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LoginSchema, type LoginInput } from '@orderhub/contracts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/form-errors';
import { safeNextPath } from '@/lib/safe-next';
import { useAuth } from '@/features/auth/use-auth';
import { useCart } from '@/features/cart/use-cart';

// Next.js 15 requires useSearchParams() callers to sit under a Suspense
// boundary, otherwise the page fails to prerender. The form itself has no
// loading state worth showing in the fallback, so an empty fallback is fine.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/products');
  const login = useAuth((s) => s.login);
  const consumePendingAdd = useCart((s) => s.consumePendingAdd);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    try {
      await login(values.email, values.password);
      // If the user was bounced here mid-Add-to-cart, push the pending item
      // into the real cart before navigating.
      consumePendingAdd();
      router.replace(next);
    } catch (err) {
      const handled = applyServerErrors(setError, err);
      if (!handled) {
        setError('root', {
          message:
            err instanceof ApiError ? err.message : 'Something went wrong',
        });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.message });
      }
    }
  }

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {errors.root?.message ? (
          <Alert tone="error">{errors.root.message}</Alert>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link
          href={
            next === '/products'
              ? '/register'
              : `/register?next=${encodeURIComponent(next)}`
          }
          className="text-indigo-600 hover:underline"
        >
          Register
        </Link>
      </p>
    </section>
  );
}
