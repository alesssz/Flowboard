// A board: its title, card count and Columns panel (which columns show, Add a column), then the columns
// side by side; a card opens its detail over them. Cards and columns move by drag and drop (dnd-kit): with the mouse, a long press on a
// touch screen, or the keyboard from their handles. A move shows at once and is undone if the API refuses it.
import {
  type Active,
  type Announcements,
  closestCenter,
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MouseSensor,
  type Over,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Board, Card, Column } from '@flowboard/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { BoardCard } from './BoardCard.tsx';
import { moveCardInBoard } from './board-cache.ts';
import { BoardColumn, ColumnOverlay, type DragItem } from './BoardColumn.tsx';
import { BoardMenu } from './BoardMenu.tsx';
import { useLiveBoard } from '../live.ts';
import { BoardRoleContext } from './board-role.ts';
import { BoardTitle } from './BoardTitle.tsx';
import { CardDialog, type DeletedCardPlace } from './CardDialog.tsx';
import { ColumnsPanel } from './ColumnsPanel.tsx';
import { useMoveCard, useMoveColumn } from './move-mutations.ts';
import { useHiddenColumns } from './use-hidden-columns.ts';
import './BoardView.css';

interface BoardViewProps {
  board: Board;
}

// While a drag runs, the columns as they look with the dragged card moved over them (cards change
// columns as the pointer crosses them), and what is being dragged, for its copy under the pointer.
type Drag = { kind: 'card'; card: Card; columns: Column[] } | { kind: 'column'; column: Column; columns: Column[] };

// After a drop, the columns as dropped, shown until the cached board changes from `board`: the move reaches
// the cache a moment after the drop, and in between the copy under the pointer would fly back to where the
// item started, the place dnd-kit's drop animation measures.
interface Dropped {
  board: Board;
  columns: Column[];
}

/** A click this soon after a drop ends belongs to the drop, not to opening the card under it. */
const CLICK_AFTER_DROP_MS = 300;

export function BoardView({ board }: BoardViewProps) {
  const titleId = useId();
  const columnsRef = useRef<HTMLDivElement>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  useLiveBoard(board.id);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const droppedAt = useRef(0);
  const moveCard = useMoveCard(board.id);
  const moveColumn = useMoveColumn(board.id);
  const { hiddenIds, setHiddenIds } = useHiddenColumns(board.id);
  // Set by Add a column, so the board scrolls to the new column once it shows.
  const revealLastColumn = useRef(false);
  // Set when the open card is deleted, so the focus goes to its neighbour once the card has left the board.
  const focusAfterDelete = useRef<DeletedCardPlace | null>(null);
  const sensors = useSensors(
    // A few pixels of travel first, so a click still opens the card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A long press, so a swipe still scrolls the column or the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  const columns = drag?.columns ?? (dropped?.board === board ? dropped.columns : board.columns);
  // Hidden columns stay out of the drag and drop too: a column moves among the shown ones, and its place
  // in the whole board follows from the column it was dropped on.
  const shownColumns = columns.filter((column) => !hiddenIds.includes(column.id));
  const lastColumnId = shownColumns.at(-1)?.id;

  useEffect(() => {
    if (!revealLastColumn.current) return;
    revealLastColumn.current = false;
    const row = columnsRef.current;
    row?.scrollTo({ left: row.scrollWidth, behavior: 'smooth' });
  }, [lastColumnId]);

  // After every render: the one that removes the deleted card comes after the dialog has closed and given
  // the focus back to that card, which is gone.
  useEffect(() => {
    const place = focusAfterDelete.current;
    if (place === null) return;
    focusAfterDelete.current = null;
    const column = columnsRef.current?.querySelector(`[data-column-id="${window.CSS.escape(place.columnId)}"]`);
    const target =
      place.neighbourId === null
        ? column?.querySelector<HTMLElement>('.add-card__open')
        : column?.querySelector<HTMLElement>(`[data-card-id="${window.CSS.escape(place.neighbourId)}"] .board-card__open`);
    (target ?? columnsRef.current)?.focus();
  });
  const cardCount = board.columns.reduce((total, column) => total + column.cards.length, 0);
  const openCard = openCardId === null ? undefined : findCard(board, openCardId);
  const moveError = moveCard.error ?? moveColumn.error;

  function handleOpenCard(cardId: string) {
    if (Date.now() - droppedAt.current < CLICK_AFTER_DROP_MS) return;
    setOpenCardId(cardId);
  }

  function handleCloseCard() {
    setOpenCardId(null);
  }

  function handleCardDeleted(place: DeletedCardPlace) {
    focusAfterDelete.current = place;
  }

  // The focus was in the deleted column; the row of columns is the nearest place that stays.
  function handleColumnDeleted() {
    columnsRef.current?.focus();
  }

  function handleColumnAdded() {
    revealLastColumn.current = true;
  }

  function handleShowAllColumns() {
    setHiddenIds([]);
  }

  function handleDismissError() {
    moveCard.reset();
    moveColumn.reset();
  }

  function handleDragStart({ active }: DragStartEvent) {
    if (itemOf(active)?.type === 'column') {
      const column = board.columns.find((candidate) => candidate.id === active.id);
      if (column !== undefined) setDrag({ kind: 'column', column, columns: board.columns });
      return;
    }
    const found = findCard(board, String(active.id));
    if (found !== undefined) setDrag({ kind: 'card', card: found.card, columns: board.columns });
  }

  // A card crossing into another column joins it here, where the pointer is, so that column's cards make
  // room for it; moves within a column are left to the sortable list until the drop.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (drag?.kind !== 'card' || over === null) return;
    const from = columnOf(drag.columns, String(active.id));
    const to = columnOf(drag.columns, String(over.id));
    if (from === undefined || to === undefined || from.id === to.id) return;
    const overIndex = to.cards.findIndex((card) => card.id === over.id);
    const translated = active.rect.current.translated;
    const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2;
    const index = overIndex === -1 ? to.cards.length : overIndex + (below ? 1 : 0);
    setDrag({ ...drag, columns: moveCardInBoard({ ...board, columns: drag.columns }, drag.card.id, to.id, index).columns });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    droppedAt.current = Date.now();
    const ended = drag;
    setDrag(null);
    if (ended === null || over === null) return;

    if (ended.kind === 'column') {
      const from = board.columns.findIndex((column) => column.id === active.id);
      const to = board.columns.findIndex((column) => column.id === over.id);
      if (to === -1 || to === from) return;
      setDropped({ board, columns: arrayMove(board.columns, from, to) });
      moveColumn.mutate({ columnId: ended.column.id, index: to });
      return;
    }

    const column = columnOf(ended.columns, ended.card.id);
    const original = findCard(board, ended.card.id);
    if (column === undefined || original === undefined) return;
    const activeIndex = column.cards.findIndex((card) => card.id === ended.card.id);
    const overIndex = column.cards.findIndex((card) => card.id === over.id);
    const cards = overIndex === -1 ? column.cards : arrayMove(column.cards, activeIndex, overIndex);
    const index = cards.findIndex((card) => card.id === ended.card.id);
    const originalIndex = original.column.cards.findIndex((card) => card.id === ended.card.id);
    if (column.id === original.column.id && index === originalIndex) return;
    setDropped({ board, columns: ended.columns.map((candidate) => (candidate.id === column.id ? { ...column, cards } : candidate)) });
    moveCard.mutate({ cardId: ended.card.id, columnId: column.id, index });
  }

  function handleDragCancel() {
    setDrag(null);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active)}. ${placeOf(board, active, null)}`,
    onDragOver: ({ active, over }) => `${describe(active)}: ${placeOf(board, active, over)}`,
    onDragEnd: ({ active, over }) =>
      over === null ? `${describe(active)} dropped where it was.` : `Dropped ${describe(active)}: ${placeOf(board, active, over)}`,
    onDragCancel: ({ active }) => `Moving cancelled. ${describe(active)} is back where it was.`,
  };

  return (
    <BoardRoleContext value={board.role}>
      <section className="board" aria-labelledby={titleId}>
        <header className="board__header">
          <div className="board__heading">
            <BoardTitle board={board} titleId={titleId} renaming={renaming} onRenameEnd={() => setRenaming(false)} />
            {!renaming && (
              <p className="board__meta">
                {cardCount} {cardCount === 1 ? 'card' : 'cards'}
              </p>
            )}
            {board.role === 'viewer' && <p className="board__view-only">View only</p>}
          </div>
          <div className="board__tools">
            <ColumnsPanel
              boardId={board.id}
              columns={board.columns}
              hiddenIds={hiddenIds}
              onChangeHidden={setHiddenIds}
              onAdded={handleColumnAdded}
            />
            <BoardMenu board={board} onRename={() => setRenaming(true)} />
          </div>
          {moveError !== null && (
            <p className="board__alert" role="alert">
              Not moved: {moveError.message}
              <button type="button" className="board__alert-dismiss" onClick={handleDismissError}>
                Dismiss
              </button>
            </p>
          )}
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={detectCollisions}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'To move it, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel.',
            },
          }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Focusable so the keyboard can scroll it sideways. */}
          <div ref={columnsRef} className="board__columns" tabIndex={0} aria-label="Columns">
            <SortableContext items={shownColumns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
              {shownColumns.map((column) => (
                <BoardColumn
                  key={column.id}
                  boardId={board.id}
                  column={column}
                  onOpenCard={handleOpenCard}
                  onDeleted={handleColumnDeleted}
                />
              ))}
            </SortableContext>
            {shownColumns.length === 0 && (
              <div className="board__empty">
                {board.columns.length === 0 ? (
                  <p>This board has no columns yet: add the first one from Columns.</p>
                ) : (
                  <>
                    <p>Every column is hidden in this browser.</p>
                    <button type="button" className="board__empty-action" onClick={handleShowAllColumns}>
                      Show all columns
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <DragOverlay>
            {drag?.kind === 'card' && <BoardCard card={drag.card} onOpen={() => {}} lifted />}
            {drag?.kind === 'column' && <ColumnOverlay column={drag.column} />}
          </DragOverlay>
        </DndContext>

        {openCard !== undefined && (
          <CardDialog
            key={openCard.card.id}
            board={board}
            card={openCard.card}
            column={openCard.column}
            onClose={handleCloseCard}
            onDeleted={handleCardDeleted}
          />
        )}
      </section>
    </BoardRoleContext>
  );
}

// A column only meets columns. A card meets what is under the pointer, a card before its lane; the
// keyboard has no pointer, so it gets the nearest corners.
const detectCollisions: CollisionDetection = (args) => {
  const typeOf = (id: string | number) => args.droppableContainers.find((container) => container.id === id)?.data.current?.type;
  if (args.active.data.current?.type === 'column') {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => typeOf(container.id) === 'column') });
  }
  const underPointer = pointerWithin(args);
  if (underPointer.length > 0) return [underPointer.find((collision) => typeOf(collision.id) === 'card') ?? underPointer[0]!];
  return closestCorners(args);
};

// With a card lifted, Left and Right take it to the next column, at about the same height; Up and Down,
// and everything with a column lifted, are dnd-kit's sortable steps.
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, collisionRect, droppableContainers, droppableRects } = args.context;
  const step = event.code === 'ArrowLeft' ? -1 : event.code === 'ArrowRight' ? 1 : 0;
  if (step === 0 || active === null || collisionRect === null || active.data.current?.type !== 'card') {
    return sortableKeyboardCoordinates(event, args);
  }
  event.preventDefault();
  const lanes = droppableContainers
    .getEnabled()
    .filter((container) => container.data.current?.type === 'column')
    .map((container) => droppableRects.get(container.id))
    .filter((rect) => rect !== undefined)
    .sort((a, b) => a.left - b.left);
  const centre = collisionRect.left + collisionRect.width / 2;
  const current = lanes.findIndex((rect) => centre >= rect.left && centre <= rect.right);
  const next = lanes[(current === -1 ? lanes.length : current) + step];
  if (next === undefined) return undefined;
  return {
    x: next.left + (next.width - collisionRect.width) / 2,
    y: Math.max(next.top, Math.min(collisionRect.top, next.bottom - collisionRect.height)),
  };
};

function itemOf(active: Active): DragItem | undefined {
  return active.data.current as DragItem | undefined;
}

function describe(active: Active): string {
  const item = itemOf(active);
  return item === undefined ? 'Item' : item.type === 'column' ? `column ${item.title}` : `card ${item.title}`;
}

// Where the dragged item would land, from the sortable list it is over: "position 2 of 4 in Review".
function placeOf(board: Board, active: Active, over: Over | null): string {
  const target = over ?? active;
  const sortable = (target.data.current as { sortable?: { containerId: string | number; index: number; items: unknown[] } } | undefined)
    ?.sortable;
  if (itemOf(active)?.type === 'column') {
    return sortable === undefined ? '' : `position ${sortable.index + 1} of ${sortable.items.length}.`;
  }
  // Over a lane rather than a card: the card goes to the end of that column.
  const lane = board.columns.find((column) => column.id === target.id);
  if (lane !== undefined) return `at the end of ${lane.title}.`;
  const column = sortable === undefined ? undefined : board.columns.find((candidate) => candidate.id === sortable.containerId);
  return sortable === undefined || column === undefined
    ? ''
    : `position ${sortable.index + 1} of ${sortable.items.length} in ${column.title}.`;
}

function columnOf(columns: Column[], id: string): Column | undefined {
  return columns.find((column) => column.id === id || column.cards.some((card) => card.id === id));
}

function findCard(board: Board, cardId: string): { card: Card; column: Column } | undefined {
  for (const column of board.columns) {
    const card = column.cards.find((candidate) => candidate.id === cardId);
    if (card !== undefined) return { card, column };
  }
  return undefined;
}
