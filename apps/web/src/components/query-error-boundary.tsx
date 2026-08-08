'use client';

import { Card, CardContent } from '@/components/ui/card';

interface QueryErrorBoundaryProps {
  error: Error | null;
  onRetry: () => void;
  children: React.ReactNode;
}

export function QueryErrorBoundary({ error, onRetry, children }: QueryErrorBoundaryProps) {
  if (!error) {
    return <>{children}</>;
  }

  return (
    <Card className="border-red-500/50 bg-red-500/10">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div>
          <p className="font-medium text-red-400">Failed to load data</p>
          <p className="mt-1 text-sm text-red-400/80">
            {String(error.message ?? error)}. Is the indexer running?
          </p>
        </div>
        <button
          onClick={onRetry}
          className="rounded-md bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
        >
          Retry
        </button>
      </CardContent>
    </Card>
  );
}