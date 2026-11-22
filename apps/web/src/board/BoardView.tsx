// A board: its title and card count, then its columns side by side and Add a column; a card opens its detail over them.
import type { Board, Card, Column } from '@flowboard/shared';
import { useId, useRef, useState } from 'react';
import { AddColumn } from './AddColumn.tsx';
import { BoardColumn } from './BoardColumn.tsx';
import { CardDialog } from './CardDialog.tsx';
import './BoardView.css';

interface BoardViewProps {
  board: Board;
}

export function BoardView({ board }: BoardViewProps) {
  const titleId = useId();
  const columnsRef = useRef<HTMLDivElement>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const cardCount = board.columns.reduce((total, column) => total + column.cards.length, 0);
  const openCard = openCardId === null ? undefined : findCard(board, openCardId);

  function handleOpenCard(cardId: string) {
    setOpenCardId(cardId);
  }

  function handleCloseCard() {
    setOpenCardId(null);
  }

  // The focus was in the deleted column; the row of columns is the nearest place that stays.
  function handleColumnDeleted() {
    columnsRef.current?.focus();
  }

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
      <div ref={columnsRef} className="board__columns" tabIndex={0} aria-label="Columns">
        {board.columns.map((column) => (
          <BoardColumn
            key={column.id}
            boardId={board.id}
            column={column}
            onOpenCard={handleOpenCard}
            onDeleted={handleColumnDeleted}
          />
        ))}
        <AddColumn boardId={board.id} columns={board.columns} />
      </div>

      {openCard !== undefined && (
        <CardDialog
          key={openCard.card.id}
          board={board}
          card={openCard.card}
          column={openCard.column}
          onClose={handleCloseCard}
        />
      )}
    </section>
  );
}

function findCard(board: Board, cardId: string): { card: Card; column: Column } | undefined {
  for (const column of board.columns) {
    const card = column.cards.find((candidate) => candidate.id === cardId);
    if (card !== undefined) return { card, column };
  }
  return undefined;
}
