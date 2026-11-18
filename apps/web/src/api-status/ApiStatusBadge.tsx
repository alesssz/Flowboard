// Connection to the API, shown in the header: GET /api/health on load, then again while it fails.
import type { HealthResponse } from '@flowboard/shared';
import { useEffect, useState } from 'react';
import './ApiStatusBadge.css';

type ApiStatus =
  | { kind: 'loading' }
  | { kind: 'online'; health: HealthResponse }
  | { kind: 'offline'; reason: string; failures: number };

const firstRetryMs = 1_000;
const maxRetryMs = 30_000;

export function ApiStatusBadge() {
  const [status, setStatus] = useState<ApiStatus>({ kind: 'loading' });
  // Never displayed: bumping it re-runs the health check effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Aborted on cleanup, so a response arriving after unmount (or after
    // StrictMode's development re-run) never updates the state.
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`The server responded with status ${response.status}`);
        }

        // Unchecked cast until responses are validated against shared schemas.
        const health = (await response.json()) as HealthResponse;
        setStatus({ kind: 'online', health });
      } catch (error) {
        if (controller.signal.aborted) return;

        const reason = error instanceof Error ? error.message : 'Unknown error';
        setStatus((previous) => ({
          kind: 'offline',
          reason,
          failures: previous.kind === 'offline' ? previous.failures + 1 : 1,
        }));
      }
    }

    void checkHealth();

    return () => controller.abort();
  }, [attempt]);

  // Retries on its own, waiting twice as long after each failure: the API may still be starting
  // (pnpm dev starts it beside Vite) or restarting after a change. The badge stays offline meanwhile.
  useEffect(() => {
    if (status.kind !== 'offline') return;

    const delay = Math.min(firstRetryMs * 2 ** (status.failures - 1), maxRetryMs);
    const timer = setTimeout(() => setAttempt((previous) => previous + 1), delay);
    return () => clearTimeout(timer);
  }, [status]);

  // The loading state is reset here rather than at the start of the effect,
  // where a synchronous setState fails react-hooks/set-state-in-effect.
  // Also resets the wait between automatic retries.
  function handleRetry() {
    setStatus({ kind: 'loading' });
    setAttempt((previous) => previous + 1);
  }

  switch (status.kind) {
    case 'loading':
      return (
        <p className="api-status api-status--loading" role="status">
          <span className="api-status__dot" aria-hidden="true" />
          Connecting…
        </p>
      );

    case 'online':
      return (
        <p
          className="api-status api-status--online"
          role="status"
          title={`Up for ${status.health.uptimeSeconds} s`}
        >
          <span className="api-status__dot" aria-hidden="true" />
          API online
        </p>
      );

    case 'offline':
      return (
        <div className="api-status api-status--offline" role="alert">
          <span className="api-status__dot" aria-hidden="true" />
          <span title={status.reason}>API offline</span>
          <button type="button" className="api-status__retry" onClick={handleRetry}>
            Retry
          </button>
        </div>
      );
  }
}
