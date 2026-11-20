// A card's detail in a modal dialog: its column, labels, due date, assignees, full description and comments.
import type { Card, Column } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import { type MouseEvent, type PointerEvent, useEffect, useId, useRef } from 'react';
import { Tooltip } from '../Tooltip.tsx';
import { Avatar } from './Avatar.tsx';
import { cardCommentsQuery } from './board-queries.ts';
import { formatCommentTime, formatFullDateTime } from './comment-time.ts';
import { DueDate } from './DueDate.tsx';
import { Labels } from './Labels.tsx';
import './CardDialog.css';

interface CardDialogProps {
  card: Card;
  column: Column;
  /** Called once the dialog has closed, by the close button, Escape or a click on the backdrop. */
  onClose: () => void;
}

export function CardDialog({ card, column, onClose }: CardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  function handleRetryComments() {
    void comments.refetch();
  }

  function handleCloseClick() {
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
        <header className="card-dialog__header">
          <div>
            <p className="card-dialog__column" data-color={column.color}>
              <span className="card-dialog__column-dot" aria-hidden="true" />
              {column.title}
            </p>
            <h2 id={titleId} className="card-dialog__title">
              {card.title}
            </h2>
          </div>
          <button type="button" className="card-dialog__close" aria-label="Close" onClick={handleCloseClick}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        {card.labels.length > 0 && <Labels labels={card.labels} />}

        {(card.dueDate !== null || card.assignees.length > 0) && (
          <dl className="card-dialog__facts">
            {card.dueDate !== null && (
              <div>
                <dt>Due</dt>
                <dd>
                  <DueDate date={card.dueDate} today={now} />
                </dd>
              </div>
            )}
            {card.assignees.length > 0 && (
              <div>
                <dt>Assignees</dt>
                <dd>
                  <ul className="card-dialog__members">
                    {card.assignees.map((member) => (
                      <li key={member.id}>
                        <Avatar member={member} />
                        {member.name}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        )}

        <section aria-labelledby={descriptionId}>
          <h3 id={descriptionId} className="card-dialog__heading">
            Description
          </h3>
          {card.description === '' ? (
            <p className="card-dialog__empty">No description</p>
          ) : (
            <p className="card-dialog__description">{card.description}</p>
          )}
        </section>

        <section aria-labelledby={commentsId}>
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
      </div>
    </dialog>
  );
}
