// A card's editable fields, for its detail dialog. Each edits in place and saves through the API on its
// own: the field shows "Saving…" until the API answers, and stays open with the error if it refuses.
//
// Focus: buttons are never disabled while a request runs (a disabled button drops the focus); clicks are
// ignored instead. An edit closed from inside it (Save, Cancel, Enter, Escape) gives the focus back to the
// field's pencil button; one closed by clicking elsewhere leaves it where the click put it.
import {
  type Card,
  cardDescriptionMaxLength,
  cardTitleMaxLength,
  type Label,
  type Member,
  type UpdateCardRequest,
} from '@flowboard/shared';
import { type FormEvent, type KeyboardEvent, type ReactNode, useState } from 'react';
import { Avatar } from './Avatar.tsx';
import { useDeleteCard, useUpdateCard } from './card-mutations.ts';
import { DueDate } from './DueDate.tsx';
import { Labels } from './Labels.tsx';
import './CardFields.css';

interface CardTitleFieldProps {
  boardId: string;
  card: Card;
  /** The dialog is labelled by this id, so a heading keeps it while the title is edited. */
  titleId: string;
}

/** The title as the dialog's heading; a click on it, or on the pencil, edits it. Enter or leaving the field saves. */
export function CardTitleField({ boardId, card, titleId }: CardTitleFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focusPencil, setFocusPencil] = useState(false);
  const update = useUpdateCard(boardId, card.id);

  function handleEdit() {
    setDraft(card.title);
  }

  function finish(returnFocus: boolean) {
    update.reset();
    setDraft(null);
    setFocusPencil(returnFocus);
  }

  function save(returnFocus: boolean) {
    if (draft === null || update.isPending) return;
    const title = draft.trim();
    // An empty title is not a change anyone means: the card keeps its own.
    if (title === '' || title === card.title) {
      finish(returnFocus);
      return;
    }
    update.mutate({ title }, { onSuccess: () => finish(returnFocus) });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(true);
  }

  function handleBlur() {
    save(false);
  }

  if (draft === null) {
    return (
      <div className="card-field card-field--title">
        {/* Mouse users click the text; the pencil button is the way in for the keyboard. */}
        <h2 id={titleId} className="card-field__title" onClick={handleEdit}>
          {card.title}
        </h2>
        <EditButton label="Edit title" autoFocus={focusPencil} onClick={handleEdit} />
      </div>
    );
  }

  return (
    <form className="card-field card-field--title" onSubmit={handleSubmit}>
      <h2 id={titleId} className="visually-hidden">
        {card.title}
      </h2>
      <input
        className="card-field__input card-field__input--title"
        aria-label="Title"
        value={draft}
        maxLength={cardTitleMaxLength}
        readOnly={update.isPending}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => cancelOnEscape(event, () => finish(true))}
        onBlur={handleBlur}
      />
      <SaveState pending={update.isPending} error={update.error} />
    </form>
  );
}

interface CardDescriptionFieldProps {
  boardId: string;
  card: Card;
  headingId: string;
}

/** Plain text with its line breaks; the pencil opens a text area with Save and Cancel (Ctrl or ⌘ + Enter saves). */
export function CardDescriptionField({ boardId, card, headingId }: CardDescriptionFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focusPencil, setFocusPencil] = useState(false);
  const update = useUpdateCard(boardId, card.id);

  function handleEdit() {
    setDraft(card.description);
  }

  function handleFinish() {
    update.reset();
    setDraft(null);
    setFocusPencil(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null || update.isPending) return;
    const description = draft.trim();
    if (description === card.description) {
      handleFinish();
      return;
    }
    update.mutate({ description }, { onSuccess: handleFinish });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
      return;
    }
    cancelOnEscape(event, handleFinish);
  }

  return (
    <section className="card-field" aria-labelledby={headingId}>
      <div className="card-field__heading-row">
        <h3 id={headingId} className="card-field__heading">
          Description
        </h3>
        {draft === null && card.description !== '' && (
          <EditButton label="Edit description" autoFocus={focusPencil} onClick={handleEdit} />
        )}
      </div>

      {draft === null ? (
        card.description === '' ? (
          <button type="button" className="card-field__placeholder" autoFocus={focusPencil} onClick={handleEdit}>
            Add a description…
          </button>
        ) : (
          <p className="card-field__text">{card.description}</p>
        )
      ) : (
        <form className="card-field__form" onSubmit={handleSubmit}>
          <textarea
            className="card-field__input card-field__textarea"
            aria-labelledby={headingId}
            value={draft}
            rows={6}
            maxLength={cardDescriptionMaxLength}
            readOnly={update.isPending}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <FormActions pending={update.isPending} error={update.error} onCancel={handleFinish} />
        </form>
      )}
    </section>
  );
}

interface CardDueDateFieldProps {
  boardId: string;
  card: Card;
  today: Date;
}

/** The Due entry of the dialog's <dl>: the date, or None; the pencil opens the browser's date input, with Save, Remove and Cancel. */
export function CardDueDateField({ boardId, card, today }: CardDueDateFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focusPencil, setFocusPencil] = useState(false);
  const update = useUpdateCard(boardId, card.id);

  function handleEdit() {
    setDraft(card.dueDate ?? '');
  }

  function handleFinish() {
    update.reset();
    setDraft(null);
    setFocusPencil(true);
  }

  function save(dueDate: string | null) {
    if (update.isPending) return;
    if (dueDate === card.dueDate) {
      handleFinish();
      return;
    }
    update.mutate({ dueDate }, { onSuccess: handleFinish });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The input is '' while its date is cleared or incomplete: nothing to save.
    if (draft !== null && draft !== '') save(draft);
  }

  function handleRemove() {
    save(null);
  }

  if (draft === null) {
    return (
      <Fact name="Due" edit={<EditButton label="Edit due date" autoFocus={focusPencil} onClick={handleEdit} />}>
        {card.dueDate === null ? <p className="card-field__none">None</p> : <DueDate date={card.dueDate} today={today} />}
      </Fact>
    );
  }

  return (
    <Fact name="Due">
      <form className="card-field__form" onSubmit={handleSubmit}>
        <input
          type="date"
          className="card-field__input card-field__input--date"
          aria-label="Due date"
          value={draft}
          readOnly={update.isPending}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => cancelOnEscape(event, handleFinish)}
        />
        <FormActions pending={update.isPending} error={update.error} onCancel={handleFinish}>
          {card.dueDate !== null && (
            <button type="button" className="card-field__button" onClick={handleRemove}>
              Remove
            </button>
          )}
        </FormActions>
      </form>
    </Fact>
  );
}

interface CardLabelsFieldProps {
  boardId: string;
  card: Card;
  /** The board's labels, the ones offered. */
  labels: Label[];
}

/** The Labels entry of the dialog's <dl>; the pencil lists every label of the board with a checkbox, each change saved at once. */
export function CardLabelsField({ boardId, card, labels }: CardLabelsFieldProps) {
  return (
    <ChoiceField
      boardId={boardId}
      card={card}
      name="Labels"
      options={labels}
      selectedIds={card.labels.map((label) => label.id)}
      toChanges={(labelIds) => ({ labelIds })}
      selected={card.labels.length > 0 ? <Labels labels={card.labels} /> : null}
      renderOption={(label) => (
        <span className="card-field__label-pill" data-color={label.color}>
          {label.name}
        </span>
      )}
    />
  );
}

interface CardAssigneesFieldProps {
  boardId: string;
  card: Card;
  /** The board's members, the people offered. */
  members: Member[];
}

/** The Assignees entry of the dialog's <dl>; the pencil lists everyone on the board with a checkbox, each change saved at once. */
export function CardAssigneesField({ boardId, card, members }: CardAssigneesFieldProps) {
  return (
    <ChoiceField
      boardId={boardId}
      card={card}
      name="Assignees"
      options={members}
      selectedIds={card.assignees.map((member) => member.id)}
      toChanges={(assigneeIds) => ({ assigneeIds })}
      selected={
        card.assignees.length > 0 ? (
          <ul className="card-field__members">
            {card.assignees.map((member) => (
              <li key={member.id}>
                <Avatar member={member} />
                {member.name}
              </li>
            ))}
          </ul>
        ) : null
      }
      renderOption={(member) => (
        <span className="card-field__member">
          <Avatar member={member} />
          {member.name}
        </span>
      )}
    />
  );
}

interface ChoiceFieldProps<T extends { id: string }> {
  boardId: string;
  card: Card;
  /** The checkbox group's name for screen readers, and the pencil's ("Edit labels"). */
  name: string;
  /** Every choice, in display order. */
  options: T[];
  selectedIds: string[];
  toChanges: (ids: string[]) => UpdateCardRequest;
  /** What the card has; null shows None. */
  selected: ReactNode;
  renderOption: (option: T) => ReactNode;
}

// The checkboxes show what the API last returned: a click changes one only once the API has saved it.
function ChoiceField<T extends { id: string }>({
  boardId,
  card,
  name,
  options,
  selectedIds,
  toChanges,
  selected,
  renderOption,
}: ChoiceFieldProps<T>) {
  const [editing, setEditing] = useState(false);
  const [focusPencil, setFocusPencil] = useState(false);
  const update = useUpdateCard(boardId, card.id);

  function handleEdit() {
    setEditing(true);
  }

  function handleDone() {
    update.reset();
    setEditing(false);
    setFocusPencil(true);
  }

  function handleToggle(id: string, checked: boolean) {
    if (update.isPending) return;
    // In the board's order, as the card will show them.
    const next = options
      .map((option) => option.id)
      .filter((optionId) => (optionId === id ? checked : selectedIds.includes(optionId)));
    update.mutate(toChanges(next));
  }

  if (!editing) {
    return (
      <Fact
        name={name}
        edit={<EditButton label={`Edit ${name.toLowerCase()}`} autoFocus={focusPencil} onClick={handleEdit} />}
      >
        {selected ?? <p className="card-field__none">None</p>}
      </Fact>
    );
  }

  return (
    <Fact name={name}>
      <fieldset className="card-field__choices" aria-busy={update.isPending}>
        <legend className="visually-hidden">{name}</legend>
        {options.length === 0 && <p className="card-field__none">This board has none yet</p>}
        {options.map((option, index) => (
          <label key={option.id} className="card-field__choice">
            <input
              type="checkbox"
              checked={selectedIds.includes(option.id)}
              autoFocus={index === 0}
              onChange={(event) => handleToggle(option.id, event.target.checked)}
              onKeyDown={(event) => cancelOnEscape(event, handleDone)}
            />
            {renderOption(option)}
          </label>
        ))}
        <div className="card-field__actions">
          <button type="button" className="card-field__button" onClick={handleDone}>
            Done
          </button>
          <SaveState pending={update.isPending} error={update.error} />
        </div>
      </fieldset>
    </Fact>
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
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteCard(boardId, card.id);

  function handleAsk() {
    setConfirming(true);
  }

  function handleCancel() {
    if (remove.isPending) return;
    remove.reset();
    setConfirming(false);
  }

  function handleDelete() {
    if (remove.isPending) return;
    remove.mutate(undefined, { onSuccess: onDeleted });
  }

  if (!confirming) {
    return (
      <button type="button" className="card-field__button card-field__button--danger" onClick={handleAsk}>
        Delete card
      </button>
    );
  }

  return (
    <div className="card-field__confirm" role="group" aria-label="Delete card">
      <p className="card-field__confirm-text">
        Delete this card{card.commentCount > 0 && ' and its comments'}? This cannot be undone.
      </p>
      <div className="card-field__actions">
        <button
          type="button"
          className="card-field__button card-field__button--danger-solid"
          aria-disabled={remove.isPending}
          autoFocus
          onClick={handleDelete}
          onKeyDown={(event) => cancelOnEscape(event, handleCancel)}
        >
          {remove.isPending ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" className="card-field__button" aria-disabled={remove.isPending} onClick={handleCancel}>
          Cancel
        </button>
        <SaveState pending={false} error={remove.error} />
      </div>
    </div>
  );
}

interface FactProps {
  name: string;
  /** The pencil button, beside the name; absent while editing. */
  edit?: ReactNode;
  children: ReactNode;
}

// One entry of the dialog's <dl>: a name with its pencil, then the value or its editor.
function Fact({ name, edit, children }: FactProps) {
  return (
    <div className="card-field__fact">
      <dt className="card-field__fact-name">
        {name}
        {edit}
      </dt>
      <dd className="card-field__fact-value">{children}</dd>
    </div>
  );
}

interface FormActionsProps {
  pending: boolean;
  error: Error | null;
  onCancel: () => void;
  /** Extra buttons between Save and Cancel. */
  children?: ReactNode;
}

function FormActions({ pending, error, onCancel, children }: FormActionsProps) {
  function handleCancel() {
    if (!pending) onCancel();
  }

  return (
    <div className="card-field__actions">
      <button type="submit" className="card-field__button card-field__button--primary" aria-disabled={pending}>
        Save
      </button>
      {children}
      <button type="button" className="card-field__button" aria-disabled={pending} onClick={handleCancel}>
        Cancel
      </button>
      <SaveState pending={pending} error={error} />
    </div>
  );
}

interface SaveStateProps {
  pending: boolean;
  error: Error | null;
}

function SaveState({ pending, error }: SaveStateProps) {
  if (pending) {
    return (
      <p className="card-field__status" role="status">
        Saving…
      </p>
    );
  }
  if (error !== null) {
    return (
      <p className="card-field__error" role="alert">
        Not saved: {error.message}
      </p>
    );
  }
  return null;
}

interface EditButtonProps {
  label: string;
  /** True when coming back from an edit closed from inside it. */
  autoFocus: boolean;
  onClick: () => void;
}

function EditButton({ label, autoFocus, onClick }: EditButtonProps) {
  return (
    <button type="button" className="card-field__icon-button" aria-label={label} autoFocus={autoFocus} onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10.5 2.5l3 3L6 13H3v-3z" />
      </svg>
    </button>
  );
}

// Escape in a field undoes the edit; preventDefault keeps it from also closing the dialog.
function cancelOnEscape(event: KeyboardEvent<HTMLElement>, cancel: () => void) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  cancel();
}
