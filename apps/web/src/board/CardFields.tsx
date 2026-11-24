// A card's editable fields, for its detail dialog. Nothing changes shape while editing: the title and the
// description are text areas drawn as text, saved by themselves (useAutosaveText), and each detail opens its
// editor in a panel over the dialog (DetailRow), saving each change as it is made.
import {
  type Board,
  type Card,
  cardDescriptionMaxLength,
  cardTitleMaxLength,
  type Column,
  type UpdateCardRequest,
} from '@flowboard/shared';
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { Avatar } from './Avatar.tsx';
import { useDeleteCard, useUpdateCard } from './card-mutations.ts';
import { DetailRow } from './DetailRow.tsx';
import { DueDate } from './DueDate.tsx';
import { ConfirmDelete } from './FieldControls.tsx';
import { useAutoGrow } from './use-auto-grow.ts';
import { useAutosaveText } from './use-autosave-text.ts';
import { useSavedNotice } from './use-saved-notice.ts';
import './CardFields.css';

/** Pause in typing, in milliseconds, after which the description saves. */
const DESCRIPTION_IDLE_MS = 1000;

interface CardTitleFieldProps {
  boardId: string;
  card: Card;
  column: Column;
  /** The dialog is labelled by this id: a hidden heading keeps the saved title under it. */
  titleId: string;
}

/** The column the card is in, then the title. Enter or leaving the field saves; Escape restores the saved title. */
export function CardTitleField({ boardId, card, column, titleId }: CardTitleFieldProps) {
  const autosave = useAutosaveText({ boardId, card, field: 'title' });
  const areaRef = useAutoGrow(autosave.value);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // A title is one line: Enter saves instead of breaking it.
    if (event.key === 'Enter') {
      event.preventDefault();
      autosave.save();
    } else {
      undoOnEscape(event, autosave.cancel);
    }
  }

  return (
    <div className="card-field">
      <div className="card-field__meta">
        <p className="card-field__column" data-color={column.color}>
          <span className="card-field__column-dot" aria-hidden="true" />
          {column.title}
        </p>
        <SaveStatus
          pending={autosave.pending}
          justSaved={autosave.justSaved}
          savedKey={autosave.savedKey}
          error={autosave.error}
          onRetry={autosave.save}
        />
      </div>
      <h2 id={titleId} className="visually-hidden">
        {card.title}
      </h2>
      <textarea
        ref={areaRef}
        className="card-field__text card-field__text--title"
        aria-label="Title"
        rows={1}
        value={autosave.value}
        maxLength={cardTitleMaxLength}
        onChange={(event) => autosave.handleChange(event.target.value)}
        onFocus={autosave.handleFocus}
        onBlur={autosave.handleBlur}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

interface CardDescriptionFieldProps {
  boardId: string;
  card: Card;
  headingId: string;
}

/** Plain text with its line breaks; saved a moment after typing stops, on leaving the field, or on Ctrl or ⌘ + Enter. */
export function CardDescriptionField({ boardId, card, headingId }: CardDescriptionFieldProps) {
  const autosave = useAutosaveText({ boardId, card, field: 'description', idleDelay: DESCRIPTION_IDLE_MS });
  const areaRef = useAutoGrow(autosave.value);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      autosave.save();
    } else {
      undoOnEscape(event, autosave.cancel);
    }
  }

  return (
    <section className="card-field" aria-labelledby={headingId}>
      <div className="card-field__meta">
        <h3 id={headingId} className="card-field__heading">
          Description
        </h3>
        <SaveStatus
          pending={autosave.pending}
          justSaved={autosave.justSaved}
          savedKey={autosave.savedKey}
          error={autosave.error}
          onRetry={autosave.save}
        />
      </div>
      <textarea
        ref={areaRef}
        className="card-field__text card-field__text--description"
        aria-labelledby={headingId}
        placeholder="Add a description…"
        rows={3}
        value={autosave.value}
        maxLength={cardDescriptionMaxLength}
        onChange={(event) => autosave.handleChange(event.target.value)}
        onFocus={autosave.handleFocus}
        onBlur={autosave.handleBlur}
        onKeyDown={handleKeyDown}
      />
    </section>
  );
}

interface CardDetailsProps {
  /** For its id, and the labels and members a card can be given. */
  board: Board;
  card: Card;
  today: Date;
}

/** Labels, due date and assignees, one row each; a row's button opens its editor in a panel. */
export function CardDetails({ board, card, today }: CardDetailsProps) {
  return (
    <dl className="card-field__details">
      <ChoiceRow
        boardId={board.id}
        card={card}
        name="Labels"
        options={board.labels}
        selectedIds={card.labels.map((label) => label.id)}
        toChanges={(labelIds) => ({ labelIds })}
        value={
          card.labels.length === 0
            ? null
            : card.labels.map((label) => (
                <span key={label.id} className="card-field__pill" data-color={label.color}>
                  {label.name}
                </span>
              ))
        }
        renderOption={(label) => (
          <span className="card-field__pill" data-color={label.color}>
            {label.name}
          </span>
        )}
      />
      <DueRow boardId={board.id} card={card} today={today} />
      <ChoiceRow
        boardId={board.id}
        card={card}
        name="Assignees"
        options={board.members}
        selectedIds={card.assignees.map((member) => member.id)}
        toChanges={(assigneeIds) => ({ assigneeIds })}
        value={
          card.assignees.length === 0 ? null : (
            <span className="card-field__members">
              {card.assignees.map((member) => (
                <span key={member.id} className="card-field__member">
                  <Avatar member={member} />
                  {member.name}
                </span>
              ))}
            </span>
          )
        }
        renderOption={(member) => (
          <span className="card-field__member">
            <Avatar member={member} />
            {member.name}
          </span>
        )}
      />
    </dl>
  );
}

interface DueRowProps {
  boardId: string;
  card: Card;
  today: Date;
}

// The date is saved when the panel closes (Done, Enter, a click outside), not on each change: typing a
// date by hand passes through valid but unwanted days (year 0002 on the way to 2026).
function DueRow({ boardId, card, today }: DueRowProps) {
  const update = useUpdateCard(boardId, card.id);
  const notice = useSavedNotice();
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');

  function changeDraft(next: string) {
    draftRef.current = next;
    setDraft(next);
  }

  function handleOpen() {
    update.reset();
    changeDraft(card.dueDate ?? '');
  }

  function handleClose(cancelled: boolean) {
    const dueDate = draftRef.current;
    // '' is a cleared or incomplete input: nothing to save.
    if (cancelled || dueDate === '' || dueDate === card.dueDate) return;
    update.mutate({ dueDate }, { onSuccess: notice.notifySaved });
  }

  return (
    <DetailRow
      name="Due"
      value={card.dueDate === null ? <None /> : <DueDate date={card.dueDate} today={today} as="span" />}
      onOpen={handleOpen}
      onClose={handleClose}
      status={<SaveStatus pending={update.isPending} justSaved={notice.justSaved} savedKey={notice.savedKey} error={null} />}
      note={<SaveNote error={update.error} />}
    >
      {(close) => (
        <>
          <input
            type="date"
            className="card-field__date"
            aria-label="Due date"
            value={draft}
            onChange={(event) => changeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              close();
            }}
          />
          <div className="field-control__actions">
            <button type="button" className="field-control__button field-control__button--primary" onClick={close}>
              Done
            </button>
            {card.dueDate !== null && (
              <button
                type="button"
                className="field-control__button"
                onClick={() => {
                  changeDraft('');
                  update.mutate({ dueDate: null }, { onSuccess: notice.notifySaved });
                  close();
                }}
              >
                Remove date
              </button>
            )}
          </div>
        </>
      )}
    </DetailRow>
  );
}

interface ChoiceRowProps<T extends { id: string }> {
  boardId: string;
  card: Card;
  /** The row's name, and the checkbox group's. */
  name: string;
  /** Every choice, in display order. */
  options: T[];
  selectedIds: string[];
  toChanges: (ids: string[]) => UpdateCardRequest;
  /** What the card has; null shows None. */
  value: ReactNode;
  renderOption: (option: T) => ReactNode;
}

// The checkboxes show what the API last returned: a click changes one only once the API has saved it.
function ChoiceRow<T extends { id: string }>({
  boardId,
  card,
  name,
  options,
  selectedIds,
  toChanges,
  value,
  renderOption,
}: ChoiceRowProps<T>) {
  const update = useUpdateCard(boardId, card.id);
  const notice = useSavedNotice();

  function handleToggle(id: string, checked: boolean) {
    if (update.isPending) return;
    // In the board's order, as the card will show them.
    const next = options
      .map((option) => option.id)
      .filter((optionId) => (optionId === id ? checked : selectedIds.includes(optionId)));
    update.mutate(toChanges(next), { onSuccess: notice.notifySaved });
  }

  return (
    <DetailRow
      name={name}
      value={value ?? <None />}
      onOpen={update.reset}
      status={<SaveStatus pending={update.isPending} justSaved={notice.justSaved} savedKey={notice.savedKey} error={null} />}
      note={<SaveNote error={update.error} />}
    >
      {() => (
        <>
          <fieldset className="card-field__choices" aria-busy={update.isPending}>
            <legend className="visually-hidden">{name}</legend>
            {options.length === 0 && <p className="card-field__none">This board has none yet</p>}
            {options.map((option) => (
              <label key={option.id} className="card-field__choice">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(option.id)}
                  onChange={(event) => handleToggle(option.id, event.target.checked)}
                />
                {renderOption(option)}
              </label>
            ))}
          </fieldset>
          <SaveNote error={update.error} />
        </>
      )}
    </DetailRow>
  );
}

interface DeleteCardProps {
  boardId: string;
  card: Card;
  /** Runs once the API has deleted the card. */
  onDeleted: () => void;
}

/** Delete card, then a confirmation. */
export function DeleteCard({ boardId, card, onDeleted }: DeleteCardProps) {
  const remove = useDeleteCard(boardId, card.id);

  function handleDelete() {
    remove.mutate(undefined, { onSuccess: onDeleted });
  }

  return (
    <ConfirmDelete
      label="Delete card"
      question={`Delete this card${card.commentCount > 0 ? ' and its comments' : ''}?`}
      pending={remove.isPending}
      error={remove.error}
      onDelete={handleDelete}
      onCancel={remove.reset}
    />
  );
}

interface SaveStatusProps {
  pending: boolean;
  /** Shows "Saved" for a moment after a save. */
  justSaved?: boolean;
  /** Changes with each save, restarting the badge's animation. */
  savedKey?: number;
  error: Error | null;
  /** Offered with the error: sends the same change again. */
  onRetry?: () => void;
}

// Always rendered, so screen readers know the live region before it first speaks; it sits beside a heading,
// so its text coming and going moves nothing.
function SaveStatus({ pending, justSaved = false, savedKey, error, onRetry }: SaveStatusProps) {
  return (
    <p className="card-field__status" role="status">
      {pending ? (
        <span className="card-field__saving">
          <span className="card-field__spinner" aria-hidden="true" />
          Saving…
        </span>
      ) : error !== null ? (
        <span className="card-field__error">
          Not saved: {error.message}
          {onRetry !== undefined && (
            <button type="button" className="card-field__retry" onClick={onRetry}>
              Try again
            </button>
          )}
        </span>
      ) : justSaved ? (
        <span key={savedKey} className="card-field__saved">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
          Saved
        </span>
      ) : null}
    </p>
  );
}

interface SaveNoteProps {
  error: Error | null;
}

// A refused save, under a detail's value and in its panel: longer than the badge beside the name has room for.
function SaveNote({ error }: SaveNoteProps) {
  if (error === null) return null;
  return (
    <p className="card-field__note card-field__note--error" role="alert">
      Not saved: {error.message}
    </p>
  );
}

function None() {
  return <span className="card-field__none">None</span>;
}

// Escape with an unsaved change undoes it, and preventDefault keeps the key from also closing the dialog;
// with nothing to undo, the key closes the dialog as usual.
function undoOnEscape(event: KeyboardEvent<HTMLElement>, cancel: () => boolean) {
  if (event.key === 'Escape' && cancel()) event.preventDefault();
}
