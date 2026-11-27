// A card's editable fields, for its detail dialog. Nothing changes shape while editing: the title and the
// description are text areas drawn as text, saved by themselves (useAutosaveText), and each detail opens its
// editor in a panel over the dialog (DetailRow), saving each change as it is made.
import {
  type Board,
  type Card,
  cardDescriptionMaxLength,
  cardTitleMaxLength,
  type Column,
  type Label,
  type UpdateCardRequest,
} from '@flowboard/shared';
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { Tooltip } from '../Tooltip.tsx';
import { Avatar } from './Avatar.tsx';
import { useCanEdit } from './board-role.ts';
import { useDeleteCard, useUpdateCard } from './card-mutations.ts';
import { DetailRow } from './DetailRow.tsx';
import { formatDay } from './due-date.ts';
import { DueDate } from './DueDate.tsx';
import { ConfirmDelete, EditButton } from './FieldControls.tsx';
import { LabelEditor } from './LabelEditor.tsx';
import { useMoveCard } from './move-mutations.ts';
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

/**
 * The column the card is in and, once completed, since when; then the completion checkbox and the title.
 * Enter or leaving the title saves it; Escape restores the saved title.
 */
export function CardTitleField({ boardId, card, column, titleId }: CardTitleFieldProps) {
  const canEdit = useCanEdit();
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
        <p className="card-field__where">
          <span className="card-field__column" data-color={column.color}>
            <span className="card-field__column-dot" aria-hidden="true" />
            {column.title}
          </span>
          {card.completedAt !== null && (
            <span className="card-field__completed">
              Completed <time dateTime={card.completedAt}>{formatDay(new Date(card.completedAt), new Date())}</time>
            </span>
          )}
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
      <div className="card-field__title-row">
        <CompletedBox boardId={boardId} card={card} readOnly={!canEdit} />
        <textarea
          ref={areaRef}
          className="card-field__text card-field__text--title"
          aria-label="Title"
          readOnly={!canEdit}
          rows={1}
          value={autosave.value}
          maxLength={cardTitleMaxLength}
          onChange={(event) => autosave.handleChange(event.target.value)}
          onFocus={autosave.handleFocus}
          onBlur={autosave.handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}

interface CompletedBoxProps {
  boardId: string;
  card: Card;
  /** Shows the state only: for a viewer. */
  readOnly: boolean;
}

// A round checkbox before the title. It shows what the API last returned, as the details' checkboxes do;
// a refused change says so under the title.
function CompletedBox({ boardId, card, readOnly }: CompletedBoxProps) {
  const update = useUpdateCard(boardId, card.id);
  const completed = card.completedAt !== null;

  function handleChange(checked: boolean) {
    if (!update.isPending) update.mutate({ completed: checked });
  }

  return (
    <>
      <span className="card-field__complete">
        <input
          type="checkbox"
          className="card-field__complete-box"
          aria-label="Completed"
          aria-busy={update.isPending}
          disabled={readOnly}
          checked={completed}
          onChange={(event) => handleChange(event.target.checked)}
        />
        <svg className="card-field__complete-check" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 8.5l2.5 2.5 5.5-6" />
        </svg>
        {!readOnly && <Tooltip text={completed ? 'Mark not completed' : 'Mark completed'} />}
      </span>
      <SaveNote error={update.error} />
    </>
  );
}

interface CardDescriptionFieldProps {
  boardId: string;
  card: Card;
  headingId: string;
}

/** Plain text with its line breaks; saved a moment after typing stops, on leaving the field, or on Ctrl or ⌘ + Enter. */
export function CardDescriptionField({ boardId, card, headingId }: CardDescriptionFieldProps) {
  const canEdit = useCanEdit();
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
        placeholder={canEdit ? 'Add a description…' : 'No description'}
        readOnly={!canEdit}
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

/** Column and position, labels, due date and assignees, one row each; a row's button opens its editor in a panel. */
export function CardDetails({ board, card, today }: CardDetailsProps) {
  return (
    <dl className="card-field__details">
      <PlaceRow board={board} card={card} />
      <LabelsRow board={board} card={card} />
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

interface PlaceRowProps {
  board: Board;
  card: Card;
}

// Moving without dragging, for the keyboard and small screens: another column (the card goes to its
// bottom), or another position in this one. Shown at once, like a drop, and undone if the API refuses.
function PlaceRow({ board, card }: PlaceRowProps) {
  const canEdit = useCanEdit();
  const move = useMoveCard(board.id);
  const notice = useSavedNotice();
  const column = board.columns.find((candidate) => candidate.cards.some((other) => other.id === card.id));
  if (column === undefined) return null;
  const index = column.cards.findIndex((other) => other.id === card.id);

  function moveTo(columnId: string, toIndex: number) {
    if (columnId === column?.id && toIndex === index) return;
    move.mutate({ cardId: card.id, columnId, index: toIndex }, { onSuccess: notice.notifySaved });
  }

  return (
    <DetailRow
      readOnly={!canEdit}
      name="Column"
      value={
        <span className="card-field__place">
          <span className="card-field__column" data-color={column.color}>
            <span className="card-field__column-dot" aria-hidden="true" />
            {column.title}
          </span>
          <span className="card-field__none">
            {index + 1} of {column.cards.length}
          </span>
        </span>
      }
      onOpen={move.reset}
      status={<SaveStatus pending={move.isPending} justSaved={notice.justSaved} savedKey={notice.savedKey} error={null} />}
      note={<SaveNote error={move.error} />}
    >
      {() => (
        <>
          <fieldset className="card-field__choices">
            <legend className="card-field__legend">Column</legend>
            {board.columns.map((candidate) => (
              <label key={candidate.id} className="card-field__choice">
                <input
                  type="radio"
                  name={`column-of-${card.id}`}
                  checked={candidate.id === column.id}
                  onChange={() => moveTo(candidate.id, candidate.cards.length)}
                />
                <span className="card-field__column" data-color={candidate.color}>
                  <span className="card-field__column-dot" aria-hidden="true" />
                  {candidate.title}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="card-field__position">
            <span className="card-field__legend">Position</span>
            <select
              className="card-field__select"
              value={index}
              onChange={(event) => moveTo(column.id, Number(event.target.value))}
            >
              {column.cards.map((other, position) => (
                <option key={other.id} value={position}>
                  {position + 1}
                  {position === 0 ? ' (top)' : position === column.cards.length - 1 ? ' (bottom)' : ''}
                </option>
              ))}
            </select>
          </label>
          <SaveNote error={move.error} />
        </>
      )}
    </DetailRow>
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
  const canEdit = useCanEdit();
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
      readOnly={!canEdit}
      name="Due"
      value={
        card.dueDate === null ? <None /> : <DueDate date={card.dueDate} today={today} as="span" completed={card.completedAt !== null} />
      }
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

// What the labels panel shows: the board's labels to tick, or the editor of one of them or of a new one.
// `focus` is where the focus goes on coming back to the list.
type LabelsView =
  | { kind: 'list'; focus: `choice:${string}` | `edit:${string}` | 'create' | null }
  | { kind: 'edit'; labelId: string }
  | { kind: 'create' };

interface LabelsRowProps {
  board: Board;
  card: Card;
}

// The board's labels to tick, as in ChoiceRow, each with a pencil that edits it, and Create label: both turn
// the panel into the label's editor. A label created here goes on the card.
function LabelsRow({ board, card }: LabelsRowProps) {
  const canEdit = useCanEdit();
  const update = useUpdateCard(board.id, card.id);
  const notice = useSavedNotice();
  const [view, setView] = useState<LabelsView>({ kind: 'list', focus: null });
  const selectedIds = card.labels.map((label) => label.id);
  const editing = view.kind === 'edit' ? board.labels.find((label) => label.id === view.labelId) : undefined;

  function handleOpen() {
    update.reset();
    setView({ kind: 'list', focus: null });
  }

  function handleToggle(id: string, checked: boolean) {
    if (update.isPending) return;
    // In the board's order, as the card will show them.
    const next = board.labels
      .map((label) => label.id)
      .filter((labelId) => (labelId === id ? checked : selectedIds.includes(labelId)));
    update.mutate({ labelIds: next }, { onSuccess: notice.notifySaved });
  }

  function handleCreated(label: Label) {
    setView({ kind: 'list', focus: `choice:${label.id}` });
    // A new label is the board's last, so it goes last on the card too.
    update.mutate({ labelIds: [...selectedIds, label.id] }, { onSuccess: notice.notifySaved });
  }

  function handleEditorClosed(deleted: boolean) {
    setView({ kind: 'list', focus: view.kind === 'edit' && !deleted ? `edit:${view.labelId}` : 'create' });
  }

  function cardsWith(labelId: string): number {
    return board.columns.flatMap((column) => column.cards).filter((other) => other.labels.some((label) => label.id === labelId)).length;
  }

  return (
    <DetailRow
      readOnly={!canEdit}
      name="Labels"
      value={
        card.labels.length === 0 ? (
          <None />
        ) : (
          card.labels.map((label) => (
            <span key={label.id} className="card-field__pill" data-color={label.color}>
              {label.name}
            </span>
          ))
        )
      }
      onOpen={handleOpen}
      status={<SaveStatus pending={update.isPending} justSaved={notice.justSaved} savedKey={notice.savedKey} error={null} />}
      note={<SaveNote error={update.error} />}
    >
      {() =>
        view.kind === 'create' || editing !== undefined ? (
          <LabelEditor
            // A fresh draft for each label.
            key={editing?.id ?? 'new'}
            boardId={board.id}
            labels={board.labels}
            label={editing ?? null}
            cardCount={editing === undefined ? 0 : cardsWith(editing.id)}
            onCreated={handleCreated}
            onClose={handleEditorClosed}
          />
        ) : (
          <>
            <fieldset className="card-field__choices" aria-busy={update.isPending}>
              <legend className="visually-hidden">Labels</legend>
              {board.labels.length === 0 && <p className="card-field__none">This board has none yet</p>}
              {board.labels.map((label) => (
                <div key={label.id} className="card-field__label-choice">
                  <label className="card-field__choice">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(label.id)}
                      autoFocus={view.kind === 'list' && view.focus === `choice:${label.id}`}
                      onChange={(event) => handleToggle(label.id, event.target.checked)}
                    />
                    <span className="card-field__pill" data-color={label.color}>
                      {label.name}
                    </span>
                  </label>
                  <EditButton
                    label={`Edit label ${label.name}`}
                    autoFocus={view.kind === 'list' && view.focus === `edit:${label.id}`}
                    onClick={() => setView({ kind: 'edit', labelId: label.id })}
                  />
                </div>
              ))}
            </fieldset>
            <button
              type="button"
              className="card-field__create"
              autoFocus={view.kind === 'list' && view.focus === 'create'}
              onClick={() => setView({ kind: 'create' })}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 3v10M3 8h10" />
              </svg>
              Create label
            </button>
            <SaveNote error={update.error} />
          </>
        )
      }
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
  const canEdit = useCanEdit();
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
      readOnly={!canEdit}
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
