// The board's options button (⋯) and its menu: Rename board, which turns the title into a field, and Delete
// board, which asks first, then opens the first remaining board in place of the deleted one's address.
import type { Board } from '@flowboard/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useDeleteBoard } from './board-mutations.ts';
import { boardsQuery } from './board-queries.ts';
import { ConfirmDelete } from './FieldControls.tsx';
import { openBoard } from './use-board-route.ts';
import { usePopoverPanel } from './use-popover-panel.ts';
import './BoardMenu.css';

interface BoardMenuProps {
  board: Board;
  onRename: () => void;
}

export function BoardMenu({ board, onRename }: BoardMenuProps) {
  const queryClient = useQueryClient();
  const menuId = useId();
  const [menuOpenings, setMenuOpenings] = useState(0);
  const remove = useDeleteBoard(board.id);
  const { buttonRef, panelRef, open, close, handleBeforeToggle, handleToggle } = usePopoverPanel({
    onOpen: () => {
      remove.reset();
      // A fresh ConfirmDelete each time, so the menu never opens on the question.
      setMenuOpenings((count) => count + 1);
    },
  });

  function handleRename() {
    close();
    onRename();
  }

  function handleDelete() {
    remove.mutate(undefined, {
      onSuccess: () => openBoard(queryClient.getQueryData(boardsQuery.queryKey)?.[0]?.id ?? null, { replace: true }),
    });
  }

  const cardCount = board.columns.reduce((total, column) => total + column.cards.length, 0);
  const parts = [
    board.columns.length > 0 && plural(board.columns.length, 'column'),
    cardCount > 0 && plural(cardCount, 'card'),
  ].filter((part) => part !== false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="board-menu__button"
        aria-label="Board options"
        popoverTarget={menuId}
        data-open={open || undefined}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="12.5" cy="8" r="1.4" />
        </svg>
      </button>
      <div
        ref={panelRef}
        id={menuId}
        popover="auto"
        className="board-menu"
        role="group"
        aria-label="Board options"
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
      >
        <button type="button" className="field-control__button" onClick={handleRename}>
          Rename board
        </button>
        <hr className="board-menu__separator" />
        <ConfirmDelete
          key={menuOpenings}
          label="Delete board"
          question={
            parts.length === 0
              ? 'Delete this board?'
              : parts.length === 1
                ? `Delete this board and its ${parts.join('')}?`
                : `Delete this board, its ${parts.join(' and ')}?`
          }
          pending={remove.isPending}
          error={remove.error}
          onDelete={handleDelete}
          onCancel={remove.reset}
        />
      </div>
    </>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
