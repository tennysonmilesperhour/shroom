"use client";

import { useEffect } from "react";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    // Surfaced to the server console by Next.js automatically; this catches
    // anything that bubbles out of a server component or a client throw.
    console.error("[shroom] route error:", error);
  }, [error]);

  return (
    <div className="card" role="alert" style={{ marginTop: 12 }}>
      <div className="eyebrow" style={{ color: "var(--ember)" }}>
        Something went wrong
      </div>
      <h2 className="section" style={{ marginTop: 6 }}>
        We couldn&rsquo;t load this page.
      </h2>
      <p className="lead" style={{ marginBottom: 16 }}>
        The data layer rejected the request, or the schema is out of date.
        {error.digest && (
          <>
            {" "}<span className="mono muted">ref: {error.digest}</span>
          </>
        )}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="primary" onClick={reset}>
          Try again
        </button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <pre
          className="advisor-answer"
          style={{ marginTop: 16, fontSize: 12 }}
          aria-label="Error detail"
        >
          {error.message}
        </pre>
      )}
    </div>
  );
}
