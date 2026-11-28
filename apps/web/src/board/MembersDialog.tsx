// The board's members in a modal dialog, each with their role. An owner changes roles, removes members and
// invites with single-use links; anyone leaves the board from their own row. Changes wait for the API.
import { type BoardMember, type CreatedInvitation, type MemberRole, memberRoles } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, type MouseEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import { Avatar } from './Avatar.tsx';
import { boardInvitationsQuery, boardMembersQuery } from './board-queries.ts';
import { useIsOwner } from './board-role.ts';
import { ConfirmDelete, SaveState } from './FieldControls.tsx';
import { formatDay } from './due-date.ts';
import { useCreateInvitation, useRevokeInvitation } from './invitation-mutations.ts';
import { useRemoveMember, useUpdateMember } from './member-mutations.ts';
import { inviteLink } from './use-board-route.ts';
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
        {isOwner && <Invitations boardId={boardId} />}
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

interface InvitationsProps {
  boardId: string;
}

// An owner's: a role and Create a link, then the link, shown this once with Copy; then the invitations still
// usable, each with Revoke.
function Invitations({ boardId }: InvitationsProps) {
  const headingId = useId();
  const invitations = useQuery(boardInvitationsQuery(boardId));
  const create = useCreateInvitation(boardId);
  const revoke = useRevokeInvitation(boardId);
  const [role, setRole] = useState<MemberRole>('editor');
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    create.mutate(
      { role },
      {
        onSuccess: (answer) => {
          setCreated(answer);
          setCopied(false);
        },
      },
    );
  }

  // The clipboard needs a secure page; elsewhere the link is selected, to be copied by hand.
  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      linkRef.current?.select();
    }
  }

  function handleRevoke(invitationId: string) {
    if (revoke.isPending) return;
    revoke.mutate(invitationId, {
      onSuccess: () => {
        if (created?.invitation.id === invitationId) setCreated(null);
      },
    });
  }

  const link = created === null ? null : inviteLink(created.token);

  return (
    <section className="members-dialog__invite" aria-labelledby={headingId}>
      <h3 id={headingId} className="members-dialog__heading">
        Invite someone
      </h3>
      <form className="members-dialog__invite-form" onSubmit={handleCreate}>
        <label className="members-dialog__invite-role">
          As
          <select
            className="members-dialog__role-select"
            value={role}
            onChange={(event) => setRole(memberRoles.find((candidate) => candidate === event.target.value) ?? 'editor')}
          >
            {memberRoles.map((option) => (
              <option key={option} value={option}>
                {roleNames[option]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="field-control__button field-control__button--primary" aria-disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create a link'}
        </button>
      </form>
      {create.error !== null && (
        <p className="field-control__error" role="alert">
          Not created: {create.error.message}
        </p>
      )}
      {created !== null && link !== null && (
        <div className="members-dialog__link">
          <div className="members-dialog__link-row">
            <input
              ref={linkRef}
              className="members-dialog__link-input"
              aria-label="Invitation link"
              value={link}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button type="button" className="field-control__button" autoFocus onClick={() => void handleCopy(link)}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="members-dialog__link-note" role="status">
            For one person, as {roleNames[created.invitation.role].toLowerCase()}, until{' '}
            {formatDay(new Date(created.invitation.expiresAt), now)}. Copy it now: it is not shown again.
          </p>
        </div>
      )}
      {invitations.data !== undefined && invitations.data.length > 0 && (
        <>
          <h3 className="members-dialog__heading">Waiting to be used</h3>
          <ul className="members-dialog__invitations">
            {invitations.data.map((invitation) => (
              <li key={invitation.id} className="members-dialog__invitation">
                <span className="members-dialog__invitation-text">
                  {roleNames[invitation.role]}, by {invitation.invitedBy}, until {formatDay(new Date(invitation.expiresAt), now)}
                </span>
                <button
                  type="button"
                  className="field-control__button field-control__button--danger"
                  aria-disabled={revoke.isPending}
                  aria-label={`Revoke the ${roleNames[invitation.role].toLowerCase()} invitation until ${formatDay(new Date(invitation.expiresAt), now)}`}
                  onClick={() => handleRevoke(invitation.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          {revoke.error !== null && (
            <p className="field-control__error" role="alert">
              Not revoked: {revoke.error.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
