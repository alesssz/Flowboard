// A column: a coloured lane with its header (title, card count, options), its cards top to bottom, then Add a card.
import type { Column } from '@flowboard/shared';
import { useId } from 'react';
import { AddCard } from './AddCard.tsx';
import { BoardCard } from './BoardCard.tsx';
import { ColumnHeader } from './ColumnHeader.tsx';
import './BoardColumn.css';

interface BoardColumnProps {
  boardId: string;
  column: Column;
  onOpenCard: (cardId: string) => void;
  /** Runs once the API has deleted the column. */
  onDeleted: () => void;
}

export function BoardColumn({ boardId, column, onOpenCard, onDeleted }: BoardColumnProps) {
  const titleId = useId();

  return (
    <section className="board-column" data-color={column.color} aria-labelledby={titleId}>
      <ColumnHeader boardId={boardId} column={column} titleId={titleId} onDeleted={onDeleted} />

      {column.cards.length === 0 ? (
        <p className="board-column__empty">No cards</p>
      ) : (
        <ol className="board-column__cards">
          {column.cards.map((card) => (
            <li key={card.id}>
              <BoardCard card={card} onOpen={() => onOpenCard(card.id)} />
            </li>
          ))}
        </ol>
      )}

      <AddCard boardId={boardId} columnId={column.id} columnTitle={column.title} />
    </section>
  );
}
