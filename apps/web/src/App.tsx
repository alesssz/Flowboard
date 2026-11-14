/**
 * Placeholder start page: checks that the web app reaches the API through the
 * Vite proxy (GET /api/health) and shows the result. The board UI replaces it.
 */
import { useEffect, useState } from 'react';
import './App.css';

/**
 * Body of `GET /api/health`, copied from apps/api/src/app.ts. A copy can drift
 * from the original unnoticed; the shared types package will replace it.
 */
interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

/**
 * Connection state as a discriminated union on `kind`: data exists only when
 * online and a reason only when offline, so the impossible combinations that
 * separate loading/data/error variables allow cannot be represented.
 */
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

        // fetch rejects only on network failure; HTTP errors resolve normally.
        if (!response.ok) {
          throw new Error(`The server responded with status ${response.status}`);
        }

        // Unchecked cast: the body is not validated at runtime yet (schema
        // validation with Zod is planned).
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

  // The loading state is set here, in the event handler, not at the start of
  // the effect: effects synchronise with external systems, events drive state
  // changes (React guidance, enforced by the react-hooks lint rules).
  function handleRetry() {
    setApiStatus({ kind: 'loading' });
    setAttempt((previous) => previous + 1);
  }

  return (
    <main className="welcome">
      <header className="welcome__header">
        <h1 className="welcome__title">Flowboard</h1>
        <p className="welcome__subtitle">Real-time collaborative kanban board</p>
      </header>

      <StatusPanel status={apiStatus} onRetry={handleRetry} />

      <footer className="welcome__footer">
        <p>Early development: the web app and the API are connected. The board comes next.</p>
      </footer>
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
        // A live region, so screen readers announce the state changes.
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
