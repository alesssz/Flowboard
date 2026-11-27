// The board's Columns button and its panel: which columns this browser shows (useHiddenColumns), and Add a
// column. The order is the board's, changed by dragging the columns themselves.
import { type Column, columnTitleMaxLength, type PaletteColor, paletteColors } from '@flowboard/shared';
import { type FormEvent, useId, useState } from 'react';
import { useCreateColumn } from './column-mutations.ts';
import { usePopoverPanel } from './use-popover-panel.ts';
import './ColumnsPanel.css';

interface ColumnsPanelProps {
  boardId: string;
  /** Every column of the board, in order, hidden ones included. */
  columns: Column[];
  hiddenIds: string[];
  onChangeHidden: (hiddenIds: string[]) => void;
  /** Runs once the API has added a column, which shows at the end of the board. */
  onAdded: () => void;
}

export function ColumnsPanel({ boardId, columns, hiddenIds, onChangeHidden, onAdded }: ColumnsPanelProps) {
  const panelId = useId();
  const { buttonRef, panelRef, open, handleBeforeToggle, handleToggle } = usePopoverPanel();
  // Only ids of columns that still exist, so a deleted one leaves nothing behind.
  const hidden = hiddenIds.filter((id) => columns.some((column) => column.id === id));

  function handleToggleColumn(columnId: string, shown: boolean) {
    onChangeHidden(shown ? hidden.filter((id) => id !== columnId) : [...hidden, columnId]);
  }

  function handleShowAll() {
    onChangeHidden([]);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="columns-panel__button"
        popoverTarget={panelId}
        data-open={open || undefined}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3" width="3.2" height="10" rx="1" />
          <rect x="6.4" y="3" width="3.2" height="7" rx="1" />
          <rect x="10.8" y="3" width="3.2" height="8.5" rx="1" />
        </svg>
        <span className="columns-panel__label">Columns</span>
        {hidden.length > 0 && <span className="columns-panel__hidden">{hidden.length} hidden</span>}
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        className="columns-panel"
        role="group"
        aria-label="Columns"
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
      >
        <fieldset className="columns-panel__list">
          <legend className="columns-panel__heading">Show on this board</legend>
          {columns.length === 0 && <p className="columns-panel__none">No columns yet</p>}
          {columns.map((column) => (
            <label key={column.id} className="columns-panel__choice">
              <input
                type="checkbox"
                checked={!hidden.includes(column.id)}
                onChange={(event) => handleToggleColumn(column.id, event.target.checked)}
              />
              <span className="columns-panel__dot" data-color={column.color} aria-hidden="true" />
              <span className="columns-panel__title">{column.title}</span>
              <span className="columns-panel__count">
                {column.cards.length}
                <span className="visually-hidden">{column.cards.length === 1 ? ' card' : ' cards'}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {hidden.length > 0 && (
          <button type="button" className="columns-panel__show-all" onClick={handleShowAll}>
            Show all
          </button>
        )}
        <p className="columns-panel__note">Hidden only in this browser. Drag a column by its grip to reorder.</p>
        <AddColumnForm boardId={boardId} columns={columns} onAdded={onAdded} />
      </div>
    </>
  );
}

interface AddColumnFormProps {
  boardId: string;
  columns: Column[];
  onAdded: () => void;
}

// Enter adds the column and keeps the field for the next one. A new column takes a colour no other has.
function AddColumnForm({ boardId, columns, onAdded }: AddColumnFormProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState('');
  const create = useCreateColumn(boardId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (title === '' || create.isPending) return;
    create.mutate(
      { title, color: nextColor(columns) },
      {
        onSuccess: () => {
          setDraft('');
          onAdded();
        },
      },
    );
  }

  return (
    <form className="columns-panel__add" onSubmit={handleSubmit}>
      <label htmlFor={fieldId} className="columns-panel__heading">
        Add a column
      </label>
      <div className="columns-panel__add-row">
        <input
          id={fieldId}
          className="columns-panel__input"
          placeholder="Column title"
          value={draft}
          maxLength={columnTitleMaxLength}
          readOnly={create.isPending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="columns-panel__submit" aria-disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {create.error !== null && (
        <p className="columns-panel__error" role="alert">
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
