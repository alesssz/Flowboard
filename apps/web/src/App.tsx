// App shell: for a signed-in user the header, then the board or the invitation in the address; otherwise the
// sign-in page alone, which keeps the invitation's address for after signing in.
import { useQuery } from '@tanstack/react-query';
import { ApiStatusBadge } from './api-status/ApiStatusBadge.tsx';
import { AccountMenu } from './auth/AccountMenu.tsx';
import { AuthPage } from './auth/AuthPage.tsx';
import { meQuery } from './auth/auth-queries.ts';
import { BoardPage } from './board/BoardPage.tsx';
import { useInviteToken } from './board/use-board-route.ts';
import { InvitePage } from './invite/InvitePage.tsx';
import { useLiveConnection } from './live.ts';
import { Logo } from './Logo.tsx';
import { PageMessage } from './PageMessage.tsx';
import './App.css';

export default function App() {
  const me = useQuery(meQuery);
  const inviteToken = useInviteToken();
  useLiveConnection(me.data?.status === 'signed-in');

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
          {inviteToken === null ? <BoardPage /> : <InvitePage token={inviteToken} />}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="app__main">
        {me.data?.status === 'signed-out' ? (
          <AuthPage sessionEnded={me.data.ended} invited={inviteToken !== null} />
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
