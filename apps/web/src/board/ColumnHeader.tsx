// A column's header: the title, which edits in place like a card's, the card count, and the options
// button, which shows the column's colour and Delete column below the header. Saves wait for the API.
import { type Column, columnTitleMaxLength, type PaletteColor, paletteColors } from '@flowboard/shared';
import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { cancelOnEscape } from './cancel-on-escape.ts';
import { useCanEdit } from './board-role.ts';
import { useDeleteColumn, useUpdateColumn } from './column-mutations.ts';
import { ConfirmDelete, EditButton, SaveState } from './FieldControls.tsx';
import './ColumnHeader.css';

interface ColumnHeaderProps {
  boardId: string;
  column: Column;
  /** The column's section is labelled by this id, so a heading keeps it while the title is edited. */
  titleId: string;
  /** Runs once the API has deleted the column. */
  onDeleted: () => void;
  /** The grip the column is dragged by, first among the tools. */
  dragHandle?: ReactNode;
}

export function ColumnHeader({ boardId, column, titleId, onDeleted, dragHandle }: ColumnHeaderProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focusPencil, setFocusPencil] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const rename = useUpdateColumn(boardId, column.id);
  // A viewer gets the title and the count only.
  const canEdit = useCanEdit();

  function handleEdit() {
    setDraft(column.title);
  }

  function finish(returnFocus: boolean) {
    rename.reset();
    setDraft(null);
    setFocusPencil(returnFocus);
  }

  function save(returnFocus: boolean) {
    if (draft === null || rename.isPending) return;
    const title = draft.trim();
    // An empty title is not a change anyone means: the column keeps its own.
    if (title === '' || title === column.title) {
      finish(returnFocus);
      return;
    }
    rename.mutate({ title }, { onSuccess: () => finish(returnFocus) });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(true);
  }

  function handleBlur() {
    save(false);
  }

  function handleToggleOptions() {
    setOptionsOpen((open) => !open);
  }

  // The button stays mounted, so it takes the focus back directly: autoFocus works only on mounting.
  function handleCloseOptions() {
    setOptionsOpen(false);
    optionsButtonRef.current?.focus();
  }

  return (
    <>
      <header className="column-header">
        {draft === null ? (
          <>
            {/* Mouse users click the text; the pencil button is the way in for the keyboard. */}
            <h2 id={titleId} className="column-header__title" data-editable={canEdit || undefined} onClick={canEdit ? handleEdit : undefined}>
              {column.title}
            </h2>
            {/* Screen readers get the count from the list itself. */}
            <span className="column-header__count" aria-hidden="true">
              {column.cards.length}
            </span>
          </>
        ) : (
          <form className="column-header__form" onSubmit={handleSubmit}>
            <h2 id={titleId} className="visually-hidden">
              {column.title}
            </h2>
            <input
              className="column-header__input"
              aria-label="Column title"
              value={draft}
              maxLength={columnTitleMaxLength}
              readOnly={rename.isPending}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => cancelOnEscape(event, () => finish(true))}
              onBlur={handleBlur}
            />
            <SaveState pending={rename.isPending} error={rename.error} />
          </form>
        )}

        <div className="column-header__tools">
          {dragHandle}
          {draft === null && canEdit && (
            <EditButton label={`Rename ${column.title}`} autoFocus={focusPencil} onClick={handleEdit} />
          )}
          {canEdit && (
            <button
              ref={optionsButtonRef}
              type="button"
              className="field-control__icon-button column-header__options-button"
              aria-label={`${column.title} options`}
              aria-expanded={optionsOpen}
              aria-controls={optionsId}
              onClick={handleToggleOptions}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="3.5" cy="8" r="1.25" />
                <circle cx="8" cy="8" r="1.25" />
                <circle cx="12.5" cy="8" r="1.25" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {optionsOpen && (
        <ColumnOptions
          id={optionsId}
          boardId={boardId}
          column={column}
          onClose={handleCloseOptions}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}

interface ColumnOptionsProps {
  id: string;
  boardId: string;
  column: Column;
  /** Escape inside the panel, when no editor in it took the key first. */
  onClose: () => void;
  onDeleted: () => void;
}

// The radios show what the API last returned: a choice shows as made once the API has saved it.
function ColumnOptions({ id, boardId, column, onClose, onDeleted }: ColumnOptionsProps) {
  const colorName = useId();
  const recolor = useUpdateColumn(boardId, column.id);
  const remove = useDeleteColumn(boardId, column.id);
  const cardCount = column.cards.length;

  function handleColorChange(color: PaletteColor) {
    if (recolor.isPending || color === column.color) return;
    recolor.mutate({ color });
  }

  function handleDelete() {
    remove.mutate(undefined, { onSuccess: onDeleted });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) onClose();
  }

  return (
    <div id={id} className="column-header__options" role="group" aria-label={`${column.title} options`} onKeyDown={handleKeyDown}>
      <fieldset className="column-header__colors" aria-busy={recolor.isPending}>
        <legend className="column-header__legend">Colour</legend>
        <div className="column-header__swatches">
          {paletteColors.map((color) => (
            <input
              key={color}
              type="radio"
              className="column-header__swatch"
              data-color={color}
              name={colorName}
              value={color}
              aria-label={color.charAt(0).toUpperCase() + color.slice(1)}
              checked={color === column.color}
              onChange={() => handleColorChange(color)}
            />
          ))}
        </div>
        <SaveState pending={recolor.isPending} error={recolor.error} />
      </fieldset>

      <ConfirmDelete
        label="Delete column"
        question={
          cardCount === 0
            ? 'Delete this column?'
            : `Delete this column and its ${cardCount === 1 ? 'card' : `${cardCount} cards`}?`
        }
        pending={remove.isPending}
        error={remove.error}
        onDelete={handleDelete}
        onCancel={remove.reset}
      />
    </div>
  );
}
