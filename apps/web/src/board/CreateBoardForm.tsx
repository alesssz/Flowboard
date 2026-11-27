// A field and Create: a new board, with the starter columns the API gives it. Used by the list of boards
// and by the page shown before the user has any board.
import { type Board, boardTitleMaxLength } from '@flowboard/shared';
import { type FormEvent, useId, useState } from 'react';
import { cancelOnEscape } from './cancel-on-escape.ts';
import { useCreateBoard } from './board-mutations.ts';
import './CreateBoardForm.css';

interface CreateBoardFormProps {
  label: string;
  autoFocus?: boolean;
  /** Runs once the API has created the board, which is then in the cache. */
  onCreated: (board: Board) => void;
  /** Given, Escape in the field calls it, and keeps the key from closing a panel around the form. */
  onCancel?: () => void;
}

export function CreateBoardForm({ label, autoFocus = false, onCreated, onCancel }: CreateBoardFormProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState('');
  const create = useCreateBoard();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (title === '' || create.isPending) return;
    create.mutate(
      { title },
      {
        onSuccess: (board) => {
          setDraft('');
          onCreated(board);
        },
      },
    );
  }

  return (
    <form className="create-board" onSubmit={handleSubmit}>
      <label htmlFor={fieldId} className="create-board__label">
        {label}
      </label>
      <div className="create-board__row">
        <input
          id={fieldId}
          className="create-board__input"
          placeholder="Board title"
          value={draft}
          maxLength={boardTitleMaxLength}
          readOnly={create.isPending}
          autoFocus={autoFocus}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (onCancel !== undefined && !create.isPending) cancelOnEscape(event, onCancel);
          }}
        />
        <button type="submit" className="create-board__submit" aria-disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
      {create.error !== null && (
        <p className="create-board__error" role="alert">
          Not created: {create.error.message}
        </p>
      )}
    </form>
  );
}
