// App shell: the header, then the board, which shows sample data until the API serves boards.
import { ApiStatusBadge } from './api-status/ApiStatusBadge.tsx';
import { BoardView } from './board/BoardView.tsx';
import { sampleBoard } from './board/sample-board.ts';
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
        <BoardView board={sampleBoard} />
      </main>
    </div>
  );
}
