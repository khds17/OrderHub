'use client';

import type { Pagination } from '@orderhub/contracts';
import { Button } from '@/components/ui/button';

/**
 * Prev / Next pager with a "Showing X–Y of Z" readout.
 *
 * Disabled-edge buttons keep the row width stable across pages so the
 * readout doesn't reflow on the first/last page. Returns null when there
 * are no results to page through.
 */
export function PaginationControls({
  pagination,
  onChange,
}: {
  pagination: Pagination;
  onChange: (nextOffset: number) => void;
}) {
  const { limit, offset, total } = pagination;
  if (total === 0) return null;
  const start = offset + 1;
  const end = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav
      className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm"
      aria-label="Pagination"
    >
      <p className="text-slate-500">
        Showing <span className="font-medium">{start}</span>–
        <span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
