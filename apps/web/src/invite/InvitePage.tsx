// The invitation in the address, for a signed-in user: who invites them to which board, with what role, then
// Join board or Not now. A link used, revoked or expired says so; a member already is offered the board.
import type { MemberRole } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import type { MouseEvent } from 'react';
import { isClientError } from '../api.ts';
import { BoardTile } from '../board/BoardTitle.tsx';
import { formatDay } from '../board/due-date.ts';
import { openBoard } from '../board/use-board-route.ts';
import { PageMessage } from '../PageMessage.tsx';
import { invitationPreviewQuery, useAcceptInvitation } from './invite-queries.ts';
import './InvitePage.css';

const roleTexts: Record<MemberRole, string> = {
  owner: 'an owner, to manage the board and its members',
  editor: 'an editor, to change its columns, cards and labels',
  viewer: 'a viewer, to read it and comment',
};

interface InvitePageProps {
  token: string;
}

export function InvitePage({ token }: InvitePageProps) {
  const preview = useQuery(invitationPreviewQuery(token));
  const accept = useAcceptInvitation(token);

  // The invitation's address is spent either way: the board takes its place in the history.
  function handleJoin() {
    if (!accept.isPending) accept.mutate(undefined, { onSuccess: (board) => openBoard(board.id, { replace: true }) });
  }

  function handleLeave(event: MouseEvent<HTMLAnchorElement>, boardId: string | null) {
    event.preventDefault();
    openBoard(boardId, { replace: true });
  }

  if (preview.data === undefined) {
    if (!preview.isError) return <PageMessage title="Loading the invitation…" />;
    // 404: used, revoked, expired or mistyped, the API does not say which.
    return isClientError(preview.error) ? (
      <PageMessage title="This invitation is not valid" detail="It was used or revoked, or it expired. Ask an owner of the board for a new link.">
        <a href="/" className="page-message__action" onClick={(event) => handleLeave(event, null)}>
          Go to your boards
        </a>
      </PageMessage>
    ) : (
      <PageMessage
        title="Cannot load the invitation"
        detail={preview.error.message}
        retrying={preview.isFetching}
        onRetry={() => void preview.refetch()}
      />
    );
  }

  const { boardId, boardTitle, role, invitedBy, expiresAt, alreadyMember } = preview.data;
  const now = new Date();

  return (
    <section className="invite" aria-labelledby="invite-board">
      <p className="invite__from">{invitedBy} invites you to</p>
      <h1 id="invite-board" className="invite__board">
        <BoardTile boardId={boardId} title={boardTitle} />
        {boardTitle}
      </h1>
      {alreadyMember ? (
        <p className="invite__detail">You are a member of this board already, so the invitation stays unused.</p>
      ) : (
        <p className="invite__detail">
          as {roleTexts[role]}. The link works once, until{' '}
          <time dateTime={expiresAt}>{formatDay(new Date(expiresAt), now)}</time>.
        </p>
      )}
      <div className="invite__actions">
        {alreadyMember ? (
          <a href="/" className="invite__join" onClick={(event) => handleLeave(event, boardId)}>
            Open the board
          </a>
        ) : (
          <>
            <button type="button" className="invite__join" aria-disabled={accept.isPending} onClick={handleJoin}>
              {accept.isPending ? 'Joining…' : 'Join board'}
            </button>
            <a href="/" className="invite__later" onClick={(event) => handleLeave(event, null)}>
              Not now
            </a>
          </>
        )}
      </div>
      {accept.error !== null && (
        <p className="invite__error" role="alert">
          Not joined: {accept.error.message}
        </p>
      )}
    </section>
  );
}
