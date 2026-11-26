// App shell: for a signed-in user the header, then the board; otherwise the sign-in page alone.
import { useQuery } from '@tanstack/react-query';
import { ApiStatusBadge } from './api-status/ApiStatusBadge.tsx';
import { AccountMenu } from './auth/AccountMenu.tsx';
import { AuthPage } from './auth/AuthPage.tsx';
import { meQuery } from './auth/auth-queries.ts';
import { BoardPage } from './board/BoardPage.tsx';
import { Logo } from './Logo.tsx';
import { PageMessage } from './PageMessage.tsx';
import './App.css';

export default function App() {
  const me = useQuery(meQuery);

  function handleRetry() {
    void me.refetch();
  }

  // Data first: a failed background refresh keeps the page that is on screen.
  if (me.data?.status === 'signed-in') {
    return (
      <div className="app">
        <header className="app__header">
          <span className="app__brand">
            <Logo size={26} />
            <span className="app__wordmark">
              <span className="app__wordmark-accent">Flow</span>board
            </span>
          </span>
          <div className="app__header-end">
            <ApiStatusBadge />
            <AccountMenu user={me.data.user} />
          </div>
        </header>

        <main className="app__main">
          <BoardPage />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="app__main">
        {me.data?.status === 'signed-out' ? (
          <AuthPage sessionEnded={me.data.ended} />
        ) : me.isError ? (
          <PageMessage
            title="Cannot reach Flowboard"
            detail={me.error.message}
            retrying={me.isFetching}
            onRetry={handleRetry}
          />
        ) : (
          <PageMessage title="Loading…" />
        )}
      </main>
    </div>
  );
}
