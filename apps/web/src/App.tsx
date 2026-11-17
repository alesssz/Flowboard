/**
 * Placeholder start page: checks that the web app reaches the API through the
 * Vite proxy (GET /api/health) and shows the result. The board UI replaces it.
 */
import { useEffect, useState } from 'react';
import './App.css';

/** Body of `GET /api/health`, duplicated from apps/api/src/app.ts until the shared types package exists. */
interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

type ApiStatus =
  | { kind: 'loading' }
  | { kind: 'online'; health: HealthResponse }
  | { kind: 'offline'; reason: string };

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ kind: 'loading' });
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
        setApiStatus({ kind: 'online', health });
      } catch (error) {
        if (controller.signal.aborted) return;

        const reason = error instanceof Error ? error.message : 'Unknown error';
        setApiStatus({ kind: 'offline', reason });
      }
    }

    void checkHealth();

    return () => controller.abort();
  }, [attempt]);

  // The loading state is reset here rather than at the start of the effect,
  // where a synchronous setState fails react-hooks/set-state-in-effect.
  function handleRetry() {
    setApiStatus({ kind: 'loading' });
    setAttempt((previous) => previous + 1);
  }

  return (
    <main className="welcome">
      <header className="welcome__header">
        <h1 className="welcome__title">
          <span className="welcome__title-accent">Flow</span>board
        </h1>
        <p className="welcome__subtitle">Real-time collaborative kanban board</p>
      </header>

      <StatusPanel status={apiStatus} onRetry={handleRetry} />
    </main>
  );
}

interface StatusPanelProps {
  status: ApiStatus;
  onRetry: () => void;
}

/** Shows the API connection state; the parent decides what a retry does. */
function StatusPanel({ status, onRetry }: StatusPanelProps) {
  switch (status.kind) {
    case 'loading':
      return (
        <section className="status status--loading" role="status" aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          Checking the connection to the API…
        </section>
      );

    case 'online':
      return (
        <section className="status status--online" role="status" aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          <div>
            <strong>API online</strong>
            <p className="status__detail">
              Up for {status.health.uptimeSeconds} s · last response at{' '}
              {new Date(status.health.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </section>
      );

    case 'offline':
      return (
        <section className="status status--offline" role="alert">
          <span className="status__dot" aria-hidden="true" />
          <div>
            <strong>API unreachable</strong>
            <p className="status__detail">
              {status.reason}. Is the server running? Start it with <code>pnpm dev</code> from
              the repository root.
            </p>
            <button type="button" className="status__retry" onClick={onRetry}>
              Retry
            </button>
          </div>
        </section>
      );
  }
}
