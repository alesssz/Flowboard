// A card's comments in its dialog: the list, oldest first, a menu with Edit and Delete on the user's own, and a field to write one.
import { type Card, type CardComment, commentBodyMaxLength } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, type KeyboardEvent, type RefObject, useId, useRef, useState } from 'react';
import { Tooltip } from '../Tooltip.tsx';
import { Avatar } from './Avatar.tsx';
import { cardCommentsQuery } from './board-queries.ts';
import { cancelOnEscape } from './cancel-on-escape.ts';
import { useCreateComment, useDeleteComment, useUpdateComment } from './comment-mutations.ts';
import { formatCommentTime, formatFullDateTime } from './comment-time.ts';
import { ConfirmDelete, SaveState } from './FieldControls.tsx';
import { useAutoGrow } from './use-auto-grow.ts';
import { usePopoverPanel } from './use-popover-panel.ts';
import './CardComments.css';

interface CardCommentsProps {
  boardId: string;
  card: Card;
  /** Id for the section's heading, which names the section. */
  headingId: string;
  now: Date;
}

export function CardComments({ boardId, card, headingId, now }: CardCommentsProps) {
  const comments = useQuery(cardCommentsQuery(card.id));
  // The card's own count until the comments arrive.
  const commentCount = comments.data?.length ?? card.commentCount;
  const composerRef = useRef<HTMLTextAreaElement>(null);

  function handleRetry() {
    void comments.refetch();
  }

  // The deleted comment's buttons are gone: the focus goes to the field below the list.
  function handleDeleted() {
    composerRef.current?.focus();
  }

  return (
    <>
      <h3 id={headingId} className="card-dialog__heading">
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
            <button type="button" className="card-dialog__retry" disabled={comments.isFetching} onClick={handleRetry}>
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
            <CommentItem key={comment.id} boardId={boardId} cardId={card.id} comment={comment} now={now} onDeleted={handleDeleted} />
          ))}
        </ol>
      )}
      <NewComment boardId={boardId} cardId={card.id} textAreaRef={composerRef} />
    </>
  );
}

interface CommentItemProps {
  boardId: string;
  cardId: string;
  comment: CardComment;
  now: Date;
  onDeleted: () => void;
}

function CommentItem({ boardId, cardId, comment, now, onDeleted }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  // A new ConfirmDelete each time the menu opens, so it never reopens on a confirmation left half-way.
  const [menuOpenings, setMenuOpenings] = useState(0);
  const menuId = useId();
  const remove = useDeleteComment(boardId, cardId, comment.id);
  const { buttonRef, panelRef, open, close, handleBeforeToggle, handleToggle } = usePopoverPanel({
    onOpen: () => {
      remove.reset();
      setMenuOpenings((count) => count + 1);
    },
  });

  function handleEdit() {
    close();
    setEditing(true);
  }

  function handleEditClosed() {
    setEditing(false);
    buttonRef.current?.focus();
  }

  function handleDelete() {
    remove.mutate(undefined, { onSuccess: onDeleted });
  }

  return (
    <li className="card-dialog__comment comments__item">
      <Avatar member={comment.author} size="medium" />
      <div className="comments__main">
        <div className="card-dialog__comment-meta">
          <span className="card-dialog__comment-author">{comment.author.name}</span>
          <time className="card-dialog__comment-time" dateTime={comment.createdAt}>
            {formatCommentTime(comment.createdAt, now)}
            <Tooltip text={formatFullDateTime(comment.createdAt)} />
          </time>
          {comment.editedAt !== null && (
            <span className="comments__edited">
              edited
              <span className="visually-hidden"> on {formatFullDateTime(comment.editedAt)}</span>
              <Tooltip text={`Edited ${formatFullDateTime(comment.editedAt)}`} />
            </span>
          )}
          {comment.mine && (
            <>
              <button
                ref={buttonRef}
                type="button"
                className="field-control__icon-button comments__menu-button"
                aria-label="Comment options"
                popoverTarget={menuId}
                data-open={open || undefined}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="3.5" cy="8" r="1.25" />
                  <circle cx="8" cy="8" r="1.25" />
                  <circle cx="12.5" cy="8" r="1.25" />
                </svg>
              </button>
              <div
                ref={panelRef}
                id={menuId}
                popover="auto"
                className="comments__menu"
                role="group"
                aria-label="Comment options"
                onBeforeToggle={handleBeforeToggle}
                onToggle={handleToggle}
              >
                <button type="button" className="field-control__button" onClick={handleEdit}>
                  Edit
                </button>
                <ConfirmDelete
                  key={menuOpenings}
                  label="Delete"
                  question="Delete this comment?"
                  pending={remove.isPending}
                  error={remove.error}
                  onDelete={handleDelete}
                  onCancel={remove.reset}
                />
              </div>
            </>
          )}
        </div>
        {editing ? (
          <CommentEditor cardId={cardId} comment={comment} onClose={handleEditClosed} />
        ) : (
          <p className="card-dialog__comment-body">{comment.body}</p>
        )}
      </div>
    </li>
  );
}

interface CommentEditorProps {
  cardId: string;
  comment: CardComment;
  /** Saved, or cancelled. */
  onClose: () => void;
}

function CommentEditor({ cardId, comment, onClose }: CommentEditorProps) {
  const [draft, setDraft] = useState(comment.body);
  const update = useUpdateComment(cardId, comment.id);
  const areaRef = useAutoGrow(draft);

  function handleSave() {
    if (update.isPending) return;
    const body = draft.trim();
    if (body === '') return;
    if (body === comment.body) {
      onClose();
      return;
    }
    update.mutate({ body }, { onSuccess: onClose });
  }

  function handleCancel() {
    if (!update.isPending) onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSave();
    } else {
      cancelOnEscape(event, handleCancel);
    }
  }

  return (
    <div className="comments__editor">
      <textarea
        ref={areaRef}
        className="comments__input"
        aria-label="Comment"
        value={draft}
        maxLength={commentBodyMaxLength}
        readOnly={update.isPending}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="field-control__actions">
        <button
          type="button"
          className="field-control__button field-control__button--primary"
          aria-disabled={update.isPending || draft.trim() === ''}
          onClick={handleSave}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="field-control__button" aria-disabled={update.isPending} onClick={handleCancel}>
          Cancel
        </button>
        <SaveState pending={false} error={update.error} />
      </div>
    </div>
  );
}

interface NewCommentProps {
  boardId: string;
  cardId: string;
  /** The field, for the focus after a deletion. */
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
}

function NewComment({ boardId, cardId, textAreaRef }: NewCommentProps) {
  const [draft, setDraft] = useState('');
  const create = useCreateComment(boardId, cardId);
  const fieldId = useId();
  const growRef = useAutoGrow(draft);

  // useAutoGrow owns its ref; the parent's ref follows the same element.
  function setRefs(element: HTMLTextAreaElement | null) {
    growRef.current = element;
    textAreaRef.current = element;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    const body = draft.trim();
    if (body === '') return;
    create.mutate({ body }, { onSuccess: () => setDraft('') });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form className="comments__composer" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={fieldId}>
        Write a comment
      </label>
      <textarea
        ref={setRefs}
        id={fieldId}
        className="comments__input"
        placeholder="Write a comment…"
        rows={1}
        value={draft}
        maxLength={commentBodyMaxLength}
        readOnly={create.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {/* Only once something is typed: an empty field stays one quiet line. */}
      {(draft !== '' || create.error !== null) && (
        <div className="field-control__actions">
          <button
            type="submit"
            className="field-control__button field-control__button--primary"
            aria-disabled={create.isPending || draft.trim() === ''}
          >
            {create.isPending ? 'Sending…' : 'Comment'}
          </button>
          {create.error !== null && (
            <p className="field-control__error" role="alert">
              Not sent: {create.error.message}
            </p>
          )}
        </div>
      )}
      <p className="visually-hidden" role="status">
        {create.isSuccess ? 'Comment added' : ''}
      </p>
    </form>
  );
}
