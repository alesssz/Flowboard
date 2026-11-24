// The board on screen: the first board from the API, or the state that stands in for it (loading, error, none).
import { useQuery } from '@tanstack/react-query';
import { boardQuery, boardsQuery } from './board-queries.ts';
import { BoardView } from './BoardView.tsx';
import './BoardPage.css';

export function BoardPage() {
  const boards = useQuery(boardsQuery);

  function handleRetry() {
    void boards.refetch();
  }

  if (boards.data === undefined) {
    return boards.isError ? (
      <BoardMessage
        title="Cannot load the boards"
        detail={boards.error.message}
        retrying={boards.isFetching}
        onRetry={handleRetry}
      />
    ) : (
      <BoardMessage title="Loading the board…" />
    );
  }

  // One board for now; a board switcher comes with board editing.
  const firstBoard = boards.data[0];
  if (firstBoard === undefined) return <BoardMessage title="No boards yet" />;

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
      <BoardMessage
        title="Cannot load the board"
        detail={board.error.message}
        retrying={board.isFetching}
        onRetry={handleRetry}
      />
    );
  }
  return <BoardMessage title="Loading the board…" />;
}

interface BoardMessageProps {
  title: string;
  detail?: string;
  /** Given for an error: adds a retry button, and screen readers announce the message at once. */
  onRetry?: () => void;
  /** Disables the retry button while the request runs again. */
  retrying?: boolean;
}

function BoardMessage({ title, detail, onRetry, retrying = false }: BoardMessageProps) {
  return (
    <div className="board-message" role={onRetry === undefined ? 'status' : 'alert'}>
      <p className="board-message__title">{title}</p>
      {detail !== undefined && <p className="board-message__detail">{detail}</p>}
      {onRetry !== undefined && (
        <button type="button" className="board-message__retry" disabled={retrying} onClick={onRetry}>
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}
