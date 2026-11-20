// App shell: the header, then the board.
import { ApiStatusBadge } from './api-status/ApiStatusBadge.tsx';
import { BoardPage } from './board/BoardPage.tsx';
import { Logo } from './Logo.tsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">
          <Logo size={26} />
          <span className="app__wordmark">
            <span className="app__wordmark-accent">Flow</span>board
          </span>
        </span>
        <ApiStatusBadge />
      </header>

      <main className="app__main">
        <BoardPage />
      </main>
    </div>
  );
}
