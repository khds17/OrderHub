import type { Metadata } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/error-boundary';
import { Nav } from '@/components/nav';
import { QueryProvider } from '@/components/query-provider';

export const metadata: Metadata = {
  title: 'OrderHub',
  description: 'OrderHub v1 — Next.js + Fastify learning project',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <QueryProvider>
            <Nav />
            <main
              id="main"
              className="mx-auto max-w-5xl px-4 py-8"
            >
              {children}
            </main>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
