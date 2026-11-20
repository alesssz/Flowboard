// "Add a card" at the bottom of a column: opens a title field; Enter adds the card and keeps the field
// open for the next one, Escape or × closes it.
import { cardTitleMaxLength } from '@flowboard/shared';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { useCreateCard } from './card-mutations.ts';
import './AddCard.css';

interface AddCardProps {
  boardId: string;
  columnId: string;
  /** For the field's name, "Title of a new card in To do". */
  columnTitle: string;
}

export function AddCard({ boardId, columnId, columnTitle }: AddCardProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focusOpener, setFocusOpener] = useState(false);
  const create = useCreateCard(boardId, columnId);

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
    create.mutate({ title }, { onSuccess: () => setDraft('') });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // A title is one line: Enter adds the card instead of breaking the line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    } else if (event.key === 'Escape') {
      handleClose();
    }
  }

  if (draft === null) {
    return (
      <button type="button" className="add-card__open" autoFocus={focusOpener} onClick={handleOpen}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
        Add a card
      </button>
    );
  }

  return (
    <form className="add-card__form" onSubmit={handleSubmit}>
      {/* A text area so a long title wraps while it is typed. */}
      <textarea
        className="add-card__input"
        aria-label={`Title of a new card in ${columnTitle}`}
        placeholder="Card title"
        rows={2}
        value={draft}
        maxLength={cardTitleMaxLength}
        readOnly={create.isPending}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="add-card__actions">
        <button type="submit" className="add-card__submit" aria-disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add card'}
        </button>
        <button type="button" className="add-card__close" aria-label="Close" onClick={handleClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {create.error !== null && (
        <p className="add-card__error" role="alert">
          Not added: {create.error.message}
        </p>
      )}
    </form>
  );
}
