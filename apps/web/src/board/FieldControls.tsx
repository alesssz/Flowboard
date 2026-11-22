// Controls shared by the in-place editors of cards and columns: the pencil, the save state, and a delete
// button that asks first. Buttons are never disabled while a request runs (a disabled button drops the
// focus): their handlers ignore clicks instead, and aria-disabled says so.
import { useState } from 'react';
import { cancelOnEscape } from './cancel-on-escape.ts';
import './FieldControls.css';

interface EditButtonProps {
  label: string;
  /** True when coming back from an edit closed from inside it. */
  autoFocus: boolean;
  onClick: () => void;
}

/** The pencil: the keyboard's way into an editor that the mouse opens by clicking the value. */
export function EditButton({ label, autoFocus, onClick }: EditButtonProps) {
  return (
    <button type="button" className="field-control__icon-button" aria-label={label} autoFocus={autoFocus} onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10.5 2.5l3 3L6 13H3v-3z" />
      </svg>
    </button>
  );
}

interface SaveStateProps {
  pending: boolean;
  error: Error | null;
}

/** "Saving…" while the API works, then nothing, or the reason it refused. */
export function SaveState({ pending, error }: SaveStateProps) {
  if (pending) {
    return (
      <p className="field-control__status" role="status">
        Saving…
      </p>
    );
  }
  if (error !== null) {
    return (
      <p className="field-control__error" role="alert">
        Not saved: {error.message}
      </p>
    );
  }
  return null;
}

interface ConfirmDeleteProps {
  /** The button's text, and the name of the confirmation: "Delete card". */
  label: string;
  /** What goes, as a question; "This cannot be undone." follows it. */
  question: string;
  pending: boolean;
  error: Error | null;
  onDelete: () => void;
  /** Runs when the confirmation is cancelled, to clear the last error. */
  onCancel: () => void;
}

/** The delete button, then a confirmation with Delete, focused, and Cancel; Escape cancels. */
export function ConfirmDelete({ label, question, pending, error, onDelete, onCancel }: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false);
  const [focusButton, setFocusButton] = useState(false);

  function handleAsk() {
    setConfirming(true);
  }

  function handleCancel() {
    if (pending) return;
    onCancel();
    setConfirming(false);
    setFocusButton(true);
  }

  function handleDelete() {
    if (!pending) onDelete();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="field-control__button field-control__button--danger"
        autoFocus={focusButton}
        onClick={handleAsk}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="field-control__confirm" role="group" aria-label={label}>
      <p className="field-control__confirm-text">{question} This cannot be undone.</p>
      <div className="field-control__actions">
        <button
          type="button"
          className="field-control__button field-control__button--danger-solid"
          aria-disabled={pending}
          autoFocus
          onClick={handleDelete}
          onKeyDown={(event) => cancelOnEscape(event, handleCancel)}
        >
          {pending ? 'Deleting…' : 'Delete'}
        </button>
        <button
          type="button"
          className="field-control__button"
          aria-disabled={pending}
          onClick={handleCancel}
          onKeyDown={(event) => cancelOnEscape(event, handleCancel)}
        >
          Cancel
        </button>
        <SaveState pending={false} error={error} />
      </div>
    </div>
  );
}
