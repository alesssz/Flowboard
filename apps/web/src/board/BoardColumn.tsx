// A column: a coloured lane with its header (title, card count, options), its cards top to bottom, then
// Add a card. The lane and each card are sortable (dnd-kit): BoardView holds the drag and drop.
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Column } from '@flowboard/shared';
import { type KeyboardEventHandler, useId } from 'react';
import { AddCard } from './AddCard.tsx';
import { BoardCard } from './BoardCard.tsx';
import { ColumnHeader } from './ColumnHeader.tsx';
import { DragHandle } from './DragHandle.tsx';
import './BoardColumn.css';

/** What a sortable column or card tells the drag and drop about itself (dnd-kit's `data`). */
export type DragItem = { type: 'column'; title: string } | { type: 'card'; title: string };

interface BoardColumnProps {
  boardId: string;
  column: Column;
  onOpenCard: (cardId: string) => void;
  /** Runs once the API has deleted the column. */
  onDeleted: () => void;
}

export function BoardColumn({ boardId, column, onOpenCard, onDeleted }: BoardColumnProps) {
  const titleId = useId();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', title: column.title } satisfies DragItem,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'board-column board-column--placeholder' : 'board-column'}
      data-color={column.color}
      aria-labelledby={titleId}
    >
      <ColumnHeader
        boardId={boardId}
        column={column}
        titleId={titleId}
        onDeleted={onDeleted}
        dragHandle={
          <DragHandle
            ref={setActivatorNodeRef}
            label={`Move column ${column.title}`}
            {...attributes}
            {...listeners}
          />
        }
      />

      {/* The lane is a drop target too, so a card can go into an empty column. */}
      <SortableContext id={column.id} items={column.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        {column.cards.length === 0 ? (
          <p className="board-column__empty">No cards</p>
        ) : (
          <ol className="board-column__cards">
            {column.cards.map((card) => (
              <SortableCard key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
            ))}
          </ol>
        )}
      </SortableContext>

      <AddCard boardId={boardId} columnId={column.id} columnTitle={column.title} />
    </section>
  );
}

interface SortableCardProps {
  card: Card;
  onOpen: () => void;
}

// The mouse drags the whole card, and a touch a long press on it; the keyboard uses the handle only, as
// Enter on the card's title opens it.
function SortableCard({ card, onOpen }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', title: card.title } satisfies DragItem,
  });
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'board-column__placeholder' : undefined}
      {...pointerListeners}
    >
      <BoardCard
        card={card}
        onOpen={onOpen}
        dragHandle={
          <DragHandle
            ref={setActivatorNodeRef}
            label={`Move ${card.title}`}
            {...attributes}
            // dnd-kit types its listeners loosely, as Function.
            onKeyDown={onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
          />
        }
      />
    </li>
  );
}

interface ColumnOverlayProps {
  column: Column;
}

/** The copy of a column that follows the pointer while it is dragged: its header and its cards' titles. */
export function ColumnOverlay({ column }: ColumnOverlayProps) {
  return (
    <div className="board-column board-column--lifted" data-color={column.color}>
      <p className="board-column__overlay-title">
        {column.title} <span className="board-column__overlay-count">{column.cards.length}</span>
      </p>
      <ol className="board-column__cards">
        {column.cards.map((card) => (
          <li key={card.id}>
            <BoardCard card={card} onOpen={() => {}} lifted />
          </li>
        ))}
      </ol>
    </div>
  );
}
