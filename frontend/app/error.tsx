"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils/errorMessage";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="brand-card p-8 max-w-xl w-full text-center space-y-4">
        <p className="text-destructive break-all whitespace-pre-wrap">
          {errorMessage(error)}
        </p>
        <Button type="button" variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
