// The board on screen: the one in the address (/boards/<id>), else the user's first; or what stands in for it
// (loading, an error, a board that is not there, none yet).
import { useQuery } from '@tanstack/react-query';
import type { MouseEvent } from 'react';
import { PageMessage } from '../PageMessage.tsx';
import { boardQuery, boardsQuery } from './board-queries.ts';
import { BoardView } from './BoardView.tsx';
import { CreateBoardForm } from './CreateBoardForm.tsx';
import { openBoard, useBoardRoute } from './use-board-route.ts';
import './BoardPage.css';

export function BoardPage() {
  const boards = useQuery(boardsQuery);
  const routeId = useBoardRoute();

  function handleRetry() {
    void boards.refetch();
  }

  function handleFirstBoard(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    openBoard(null);
  }

  if (boards.data === undefined) {
    return boards.isError ? (
      <PageMessage
        title="Cannot load the boards"
        detail={boards.error.message}
        retrying={boards.isFetching}
        onRetry={handleRetry}
      />
    ) : (
      <PageMessage title="Loading the board…" />
    );
  }

  const firstBoard = boards.data[0];
  if (firstBoard === undefined) return <FirstBoard />;

  // The list is checked first: a board deleted, or never the user's, needs no request to say so.
  const boardId = routeId ?? firstBoard.id;
  if (!boards.data.some((board) => board.id === boardId)) {
    return (
      <PageMessage title="This board is not here" detail="It was deleted, or you are not one of its members.">
        <a href="/" className="page-message__action" onClick={handleFirstBoard}>
          Open {firstBoard.title}
        </a>
      </PageMessage>
    );
  }

  return <LoadedBoard boardId={boardId} />;
}

// Before the user has any board: what one is, and the field to create it.
function FirstBoard() {
  return (
    <section className="first-board" aria-labelledby="first-board-title">
      <h1 id="first-board-title" className="first-board__title">
        Create your first board
      </h1>
      <p className="first-board__detail">It starts with three columns, To do, In progress and Done, which you can rename, recolour or delete.</p>
      <CreateBoardForm label="Board title" autoFocus onCreated={(board) => openBoard(board.id)} />
    </section>
  );
}

interface LoadedBoardProps {
  boardId: string;
}

function LoadedBoard({ boardId }: LoadedBoardProps) {
  const board = useQuery(boardQuery(boardId));

  function handleRetry() {
    void board.refetch();
  }

  // Data first: a failed background refresh keeps showing the board it already has.
  // Keyed by board, so state kept per board (hidden columns, an open card) starts afresh on another one.
  if (board.data !== undefined) return <BoardView key={board.data.id} board={board.data} />;
  if (board.isError) {
    return (
      <PageMessage
        title="Cannot load the board"
        detail={board.error.message}
        retrying={board.isFetching}
        onRetry={handleRetry}
      />
    );
  }
  return <PageMessage title="Loading the board…" />;
}
