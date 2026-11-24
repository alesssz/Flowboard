// A card's detail in a modal dialog, in two columns: the title, description and comments on the left, the
// details and Delete card on the right (below the title on a phone). Every field edits where it is.
import type { Board, Card, Column } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import { type MouseEvent, type PointerEvent, useEffect, useId, useRef } from 'react';
import { Tooltip } from '../Tooltip.tsx';
import { Avatar } from './Avatar.tsx';
import { cardCommentsQuery } from './board-queries.ts';
import { CardDescriptionField, CardDetails, CardTitleField, DeleteCard } from './CardFields.tsx';
import { formatCommentTime, formatFullDateTime } from './comment-time.ts';
import './CardDialog.css';

interface CardDialogProps {
  /** For its id, and the labels and members a card can be given. */
  board: Board;
  card: Card;
  column: Column;
  /** Called once the dialog has closed, by the close button, Escape or a click on the backdrop. */
  onClose: () => void;
}

export function CardDialog({ board, card, column, onClose }: CardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const commentsId = useId();
  const now = new Date();
  const comments = useQuery(cardCommentsQuery(card.id));
  // The card's own count until the comments arrive.
  const commentCount = comments.data?.length ?? card.commentCount;

  // showModal(), not the open attribute: it makes the rest of the page inert, closes on Escape
  // and shows ::backdrop. The check skips StrictMode's second run, as showModal() on an open dialog throws.
  // The focus starts on Close, not in the title, which is a text area: a stray key would edit it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, []);

  function handleRetryComments() {
    void comments.refetch();
  }

  function handleCloseClick() {
    dialogRef.current?.close();
  }

  function handleDeleted() {
    dialogRef.current?.close();
  }

  // The content fills the dialog, so only the backdrop targets the dialog element itself. Both the press
  // and the release must be there: a text selection dragged out of the content is not a click outside.
  function handleDialogPointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="card-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={handleDialogPointerDown}
      onClick={handleDialogClick}
    >
      <div className="card-dialog__content">
        <button
          ref={closeRef}
          type="button"
          className="card-dialog__close"
          aria-label="Close"
          onClick={handleCloseClick}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="card-dialog__title">
          <CardTitleField boardId={board.id} card={card} column={column} titleId={titleId} />
        </div>

        <aside className="card-dialog__details" aria-label="Details">
          <CardDetails board={board} card={card} today={now} />
        </aside>

        <div className="card-dialog__description">
          <CardDescriptionField boardId={board.id} card={card} headingId={descriptionId} />
        </div>

        <section className="card-dialog__comments-section" aria-labelledby={commentsId}>
          <h3 id={commentsId} className="card-dialog__heading">
            Comments
            {/* Screen readers get the count from the list itself. */}
            {commentCount > 0 && (
              <span className="card-dialog__count" aria-hidden="true">
                {commentCount}
              </span>
            )}
          </h3>
          {comments.data === undefined ? (
            comments.isError ? (
              <div className="card-dialog__error" role="alert">
                <p className="card-dialog__empty">Cannot load the comments</p>
                <button
                  type="button"
                  className="card-dialog__retry"
                  disabled={comments.isFetching}
                  onClick={handleRetryComments}
                >
                  {comments.isFetching ? 'Retrying…' : 'Try again'}
                </button>
              </div>
            ) : (
              <p className="card-dialog__empty" role="status">
                Loading comments…
              </p>
            )
          ) : comments.data.length === 0 ? (
            <p className="card-dialog__empty">No comments yet</p>
          ) : (
            <ol className="card-dialog__comments">
              {comments.data.map((comment) => (
                <li key={comment.id} className="card-dialog__comment">
                  <Avatar member={comment.author} size="medium" />
                  <div>
                    <p className="card-dialog__comment-meta">
                      <span className="card-dialog__comment-author">{comment.author.name}</span>
                      <time className="card-dialog__comment-time" dateTime={comment.createdAt}>
                        {formatCommentTime(comment.createdAt, now)}
                        <Tooltip text={formatFullDateTime(comment.createdAt)} />
                      </time>
                    </p>
                    <p className="card-dialog__comment-body">{comment.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Last in the page's order, after the comments; drawn at the foot of the details column. */}
        <div className="card-dialog__delete">
          <DeleteCard boardId={board.id} card={card} onDeleted={handleDeleted} />
        </div>
      </div>
    </dialog>
  );
}
