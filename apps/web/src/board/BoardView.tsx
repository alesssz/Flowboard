// A board: its title and card count, then its columns side by side.
import type { Board } from '@flowboard/shared';
import { useId } from 'react';
import { BoardColumn } from './BoardColumn.tsx';
import './BoardView.css';

interface BoardViewProps {
  board: Board;
}

export function BoardView({ board }: BoardViewProps) {
  const titleId = useId();
  const cardCount = board.columns.reduce((total, column) => total + column.cards.length, 0);

  return (
    <section className="board" aria-labelledby={titleId}>
      <header className="board__header">
        <h1 id={titleId} className="board__title">
          {board.title}
        </h1>
        <p className="board__meta">
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </p>
      </header>

      {/* Focusable so the keyboard can scroll it sideways. */}
      <div className="board__columns" tabIndex={0} aria-label="Columns">
        {board.columns.map((column) => (
          <BoardColumn key={column.id} column={column} />
        ))}
      </div>
    </section>
  );
}
