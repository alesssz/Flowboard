// Live updates: one Socket.IO connection while the user is signed in, following the board on screen. A notice
// marks what changed as stale and TanStack Query reads it again, through the API and its checks; so does a
// reconnection, for the notices missed while away.
import { type LiveClientEvents, type LiveServerEvents, liveSocketPath } from '@flowboard/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { setLiveSocketId } from './api.ts';
import { boardQuery, boardsQuery, cardCommentsQuery } from './board/board-queries.ts';
import { moveKey } from './board/move-mutations.ts';

// Same origin, through the dev proxy in development; opened by useLiveConnection only.
const socket: Socket<LiveServerEvents, LiveClientEvents> = io({ path: liveSocketPath, autoConnect: false });

/** The board on screen, followed again after each reconnection. */
let followed: string | null = null;

function follow(boardId: string | null): void {
  // The answer says only whether it worked: a board not followed still loads, it just does not update itself.
  if (socket.connected) socket.emit('board:watch', boardId, () => {});
}

/** Keeps the connection open while `signedIn`, and closes it on sign-out. Called once, by App. */
export function useLiveConnection(signedIn: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!signedIn) return;

    function handleConnect() {
      setLiveSocketId(socket.id);
      follow(followed);
    }

    function handleDisconnect() {
      setLiveSocketId(undefined);
    }

    // Notices may have been missed while the connection was down: everything on screen is read again.
    function handleReconnect() {
      void queryClient.invalidateQueries({ queryKey: boardsQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
    }

    // The board, its list entry, its members and invitations all sit under ['boards', …]. While a move of the
    // user's is on its way they are only marked stale: its answer brings the board up to date, and a read now
    // would put the dragged card back for a moment.
    function handleBoardChanged({ boardId }: { boardId: string }) {
      const moving = queryClient.isMutating({ mutationKey: moveKey(boardId) }) > 0;
      void queryClient.invalidateQueries({ queryKey: boardsQuery.queryKey, refetchType: moving ? 'none' : 'active' });
    }

    function handleCommentsChanged({ boardId, cardId }: { boardId: string; cardId: string }) {
      void queryClient.invalidateQueries({ queryKey: cardCommentsQuery(cardId).queryKey });
      // The card's comment count.
      void queryClient.invalidateQueries({ queryKey: boardQuery(boardId).queryKey, exact: true });
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect', handleReconnect);
    socket.on('board:changed', handleBoardChanged);
    socket.on('comments:changed', handleCommentsChanged);
    socket.connect();
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect', handleReconnect);
      socket.off('board:changed', handleBoardChanged);
      socket.off('comments:changed', handleCommentsChanged);
      socket.disconnect();
      setLiveSocketId(undefined);
    };
  }, [signedIn, queryClient]);
}

/** Follows the board while it is on screen. Called by BoardView. */
export function useLiveBoard(boardId: string): void {
  useEffect(() => {
    followed = boardId;
    follow(boardId);
    return () => {
      if (followed !== boardId) return;
      followed = null;
      follow(null);
    };
  }, [boardId]);
}
