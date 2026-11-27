// The board's members in a modal dialog, each with their role. An owner changes roles and removes members;
// anyone leaves the board from their own row. Changes wait for the API.
import { type BoardMember, type MemberRole, memberRoles } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import { type MouseEvent, type PointerEvent, useEffect, useId, useRef } from 'react';
import { Avatar } from './Avatar.tsx';
import { boardMembersQuery } from './board-queries.ts';
import { useIsOwner } from './board-role.ts';
import { ConfirmDelete, SaveState } from './FieldControls.tsx';
import { useRemoveMember, useUpdateMember } from './member-mutations.ts';
import './MembersDialog.css';

const roleNames: Record<MemberRole, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' };

interface MembersDialogProps {
  boardId: string;
  /** Once the dialog has closed: Close, Escape or a click on the backdrop. */
  onClose: () => void;
  /** Once the API has taken the user off the board. */
  onLeft: () => void;
}

export function MembersDialog({ boardId, onClose, onLeft }: MembersDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const headingId = useId();
  const members = useQuery(boardMembersQuery(boardId));
  const isOwner = useIsOwner();

  // As CardDialog: showModal() for the backdrop and Escape; the check skips StrictMode's second run.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  // Both the press and the release on the backdrop, as in CardDialog.
  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) handleClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="members-dialog"
      aria-labelledby={headingId}
      onClose={onClose}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <div className="members-dialog__content">
        <div className="members-dialog__header">
          <h2 id={headingId} className="members-dialog__title">
            Members
          </h2>
          <button type="button" className="members-dialog__close" aria-label="Close" onClick={handleClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <p className="members-dialog__roles">
          Owners manage the board and its members. Editors change its columns, cards and labels. Viewers read it and
          comment.
        </p>
        {members.data === undefined ? (
          <p className="members-dialog__message" role={members.isError ? 'alert' : 'status'}>
            {members.isError ? `Cannot load the members: ${members.error.message}` : 'Loading the members…'}
          </p>
        ) : (
          <ul className="members-dialog__list">
            {members.data.map((member) => (
              <MemberRow key={member.id} boardId={boardId} member={member} isOwner={isOwner} onLeft={onLeft} />
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

interface MemberRowProps {
  boardId: string;
  member: BoardMember;
  /** The user owns the board: roles become a choice, and others can be removed. */
  isOwner: boolean;
  onLeft: () => void;
}

// The select shows what the API last returned: a choice shows as made once the API has saved it.
function MemberRow({ boardId, member, isOwner, onLeft }: MemberRowProps) {
  const update = useUpdateMember(boardId);
  const remove = useRemoveMember(boardId);

  function handleRole(value: string) {
    const role = memberRoles.find((candidate) => candidate === value);
    if (role === undefined || role === member.role || update.isPending) return;
    update.mutate({ member, changes: { role } });
  }

  function handleRemove() {
    remove.mutate(member, { onSuccess: member.you ? onLeft : undefined });
  }

  return (
    <li className="members-dialog__member">
      <Avatar member={member} size="medium" />
      <span className="members-dialog__name">
        {member.name}
        {member.you && <span className="members-dialog__you"> (you)</span>}
      </span>
      {isOwner ? (
        <select
          className="members-dialog__role-select"
          aria-label={`Role of ${member.name}`}
          aria-busy={update.isPending}
          value={member.role}
          onChange={(event) => handleRole(event.target.value)}
        >
          {memberRoles.map((role) => (
            <option key={role} value={role}>
              {roleNames[role]}
            </option>
          ))}
        </select>
      ) : (
        <span className="members-dialog__role">{roleNames[member.role]}</span>
      )}
      {(isOwner || member.you) && (
        <div className="members-dialog__actions">
          <ConfirmDelete
            label={member.you ? 'Leave board' : 'Remove'}
            question={member.you ? 'Leave this board?' : `Remove ${member.name} from this board?`}
            note={member.you ? 'You will need a new invitation to come back.' : 'Their name stays on their comments and cards.'}
            confirmLabel={member.you ? 'Leave' : 'Remove'}
            pendingLabel={member.you ? 'Leaving…' : 'Removing…'}
            pending={remove.isPending}
            error={remove.error}
            onDelete={handleRemove}
            onCancel={remove.reset}
          />
        </div>
      )}
      <SaveState pending={false} error={update.error} />
    </li>
  );
}
