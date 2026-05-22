'use client';

import { Component, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="mx-auto max-w-md space-y-4 py-12">
          <Alert tone="error" title="Something went wrong">
            {this.state.error.message}
          </Alert>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={this.reset}>
              Try again
            </Button>
            <Button onClick={this.reload}>Reload page</Button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
