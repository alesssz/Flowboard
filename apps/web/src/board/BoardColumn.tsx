// A column: a coloured lane with its title and card count, then its cards top to bottom.
import type { Column } from '@flowboard/shared';
import { useId } from 'react';
import { BoardCard } from './BoardCard.tsx';
import './BoardColumn.css';

interface BoardColumnProps {
  column: Column;
}

export function BoardColumn({ column }: BoardColumnProps) {
  const titleId = useId();

  return (
    <section className="board-column" data-color={column.color} aria-labelledby={titleId}>
      <header className="board-column__header">
        <h2 id={titleId} className="board-column__title">
          {column.title}
        </h2>
        {/* Screen readers get the count from the list itself. */}
        <span className="board-column__count" aria-hidden="true">
          {column.cards.length}
        </span>
      </header>

      {column.cards.length === 0 ? (
        <p className="board-column__empty">No cards</p>
      ) : (
        <ol className="board-column__cards">
          {column.cards.map((card) => (
            <li key={card.id}>
              <BoardCard card={card} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
