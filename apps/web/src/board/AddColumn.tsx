// "Add a column" after the board's last lane: opens a title field; Enter adds the column and keeps the
// field open for the next one, Escape or × closes it. A new column takes a colour no other column has.
import { type Column, columnTitleMaxLength, type PaletteColor, paletteColors } from '@flowboard/shared';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useCreateColumn } from './column-mutations.ts';
import './AddColumn.css';

interface AddColumnProps {
  boardId: string;
  /** The board's columns, for the new one's colour. */
  columns: Column[];
}

export function AddColumn({ boardId, columns }: AddColumnProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focusOpener, setFocusOpener] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const create = useCreateColumn(boardId);
  const open = draft !== null;
  const columnCount = columns.length;

  // Each column added pushes the field further right, possibly out of the scrolled row.
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [open, columnCount]);

  function handleOpen() {
    setDraft('');
  }

  function handleClose() {
    if (create.isPending) return;
    create.reset();
    setDraft(null);
    setFocusOpener(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null || create.isPending) return;
    const title = draft.trim();
    if (title === '') return;
    create.mutate({ title, color: nextColor(columns) }, { onSuccess: () => setDraft('') });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') handleClose();
  }

  if (draft === null) {
    return (
      <button type="button" className="add-column add-column__open" autoFocus={focusOpener} onClick={handleOpen}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
        Add a column
      </button>
    );
  }

  return (
    <form ref={formRef} className="add-column add-column__form" onSubmit={handleSubmit}>
      <input
        className="add-column__input"
        aria-label="Title of a new column"
        placeholder="Column title"
        value={draft}
        maxLength={columnTitleMaxLength}
        readOnly={create.isPending}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="add-column__actions">
        <button type="submit" className="add-column__submit" aria-disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add column'}
        </button>
        <button type="button" className="add-column__close" aria-label="Close" onClick={handleClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {create.error !== null && (
        <p className="add-column__error" role="alert">
          Not added: {create.error.message}
        </p>
      )}
    </form>
  );
}

// The first palette colour no column has, gray (the neutral one) aside; gray once every other is taken.
function nextColor(columns: Column[]): PaletteColor {
  const used = new Set(columns.map((column) => column.color));
  return paletteColors.find((color) => color !== 'gray' && !used.has(color)) ?? 'gray';
}
