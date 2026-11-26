// The board on screen: the first board from the API, or the state that stands in for it (loading, error, none).
import { useQuery } from '@tanstack/react-query';
import { PageMessage } from '../PageMessage.tsx';
import { boardQuery, boardsQuery } from './board-queries.ts';
import { BoardView } from './BoardView.tsx';

export function BoardPage() {
  const boards = useQuery(boardsQuery);

  function handleRetry() {
    void boards.refetch();
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

  // One board for now; a board switcher comes with board editing.
  const firstBoard = boards.data[0];
  if (firstBoard === undefined) return <PageMessage title="No boards yet" />;

  return <LoadedBoard boardId={firstBoard.id} />;
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
