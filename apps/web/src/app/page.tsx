import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">OrderHub</h1>
      <p className="text-slate-600">
        A learning project: REST API on Fastify + Postgres, decoupled Next.js
        storefront.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/products">
          <Button>Browse products</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Sign in</Button>
        </Link>
      </div>
    </section>
  );
}
