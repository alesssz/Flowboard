// The board's title in its header: its initial and name, a button that opens the list of the user's boards
// with New board at its end; or, while the board is renamed from BoardMenu, the field for its new title.
import { type Board, boardTitleMaxLength, type PaletteColor, paletteColors } from '@flowboard/shared';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, type MouseEvent, useEffect, useId, useState } from 'react';
import { useRenameBoard } from './board-mutations.ts';
import { boardsQuery } from './board-queries.ts';
import { cancelOnEscape } from './cancel-on-escape.ts';
import { CreateBoardForm } from './CreateBoardForm.tsx';
import { SaveState } from './FieldControls.tsx';
import { boardPath, openBoard, takeFocusRequest } from './use-board-route.ts';
import { usePopoverPanel } from './use-popover-panel.ts';
import './BoardTitle.css';

interface BoardTitleProps {
  board: Board;
  /** The board's section is labelled by this id, so a heading keeps it while the title is edited. */
  titleId: string;
  renaming: boolean;
  /** Once the rename field has closed, saved or not. */
  onRenameEnd: () => void;
}

export function BoardTitle({ board, titleId, renaming, onRenameEnd }: BoardTitleProps) {
  const [focusSwitcher, setFocusSwitcher] = useState(false);

  function handleRenameEnd(returnFocus: boolean) {
    setFocusSwitcher(returnFocus);
    onRenameEnd();
  }

  if (renaming) return <RenameField board={board} titleId={titleId} onEnd={handleRenameEnd} />;
  return <BoardSwitcher board={board} titleId={titleId} autoFocus={focusSwitcher} />;
}

interface BoardSwitcherProps {
  board: Board;
  titleId: string;
  /** True when coming back from the rename field closed from inside it. */
  autoFocus: boolean;
}

function BoardSwitcher({ board, titleId, autoFocus }: BoardSwitcherProps) {
  const panelId = useId();
  const hintId = useId();
  const boards = useQuery(boardsQuery);
  const [creating, setCreating] = useState(false);
  const [focusNew, setFocusNew] = useState(false);
  const { buttonRef, panelRef, open, close, handleBeforeToggle, handleToggle } = usePopoverPanel({
    align: 'start',
    onOpen: () => {
      setCreating(false);
      setFocusNew(false);
    },
  });

  // Mounted once per board: after the user switched, created or deleted one, the focus starts here.
  useEffect(() => {
    if (takeFocusRequest()) buttonRef.current?.focus();
  }, [buttonRef]);

  // Links, so a board opens in a new tab as any link does; a plain click stays in the page.
  function handleOpen(event: MouseEvent<HTMLAnchorElement>, boardId: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close();
    openBoard(boardId);
  }

  function handleCreated(created: Board) {
    close();
    openBoard(created.id);
  }

  function handleCancelNew() {
    setCreating(false);
    setFocusNew(true);
  }

  return (
    <>
      <h1 id={titleId} className="board-title">
        <button
          ref={buttonRef}
          type="button"
          className="board-title__switcher"
          popoverTarget={panelId}
          data-open={open || undefined}
          aria-describedby={hintId}
          autoFocus={autoFocus}
        >
          <BoardTile boardId={board.id} title={board.title} />
          <span className="board-title__text">{board.title}</span>
          <svg className="board-title__chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 6.5L8 10l3.5-3.5" />
          </svg>
        </button>
      </h1>
      <span id={hintId} hidden>
        Opens the list of boards
      </span>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        className="board-title__panel"
        role="group"
        aria-label="Boards"
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
      >
        <nav aria-labelledby={`${panelId}-heading`}>
          <h2 id={`${panelId}-heading`} className="board-title__heading">
            Your boards
          </h2>
          <ul className="board-title__list">
            {(boards.data ?? []).map((other) => (
              <li key={other.id}>
                <a
                  href={boardPath(other.id)}
                  className="board-title__board"
                  aria-current={other.id === board.id ? 'page' : undefined}
                  onClick={(event) => handleOpen(event, other.id)}
                >
                  <BoardTile boardId={other.id} title={other.title} small />
                  <span className="board-title__board-name">{other.title}</span>
                  {other.id === board.id && (
                    <svg className="board-title__check" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="board-title__new">
          {creating ? (
            <CreateBoardForm label="New board" autoFocus onCreated={handleCreated} onCancel={handleCancelNew} />
          ) : (
            <button type="button" className="board-title__new-button" autoFocus={focusNew} onClick={() => setCreating(true)}>
              <span className="board-title__plus" aria-hidden="true">
                +
              </span>
              New board
            </button>
          )}
        </div>
      </div>
    </>
  );
}

interface RenameFieldProps {
  board: Board;
  titleId: string;
  /** `returnFocus` when it closed from inside: Enter or Escape, not a click elsewhere. */
  onEnd: (returnFocus: boolean) => void;
}

// Enter or leaving the field saves; Escape keeps the title as it was.
function RenameField({ board, titleId, onEnd }: RenameFieldProps) {
  const [draft, setDraft] = useState(board.title);
  const rename = useRenameBoard(board.id);

  function save(returnFocus: boolean) {
    if (rename.isPending) return;
    const title = draft.trim();
    // An empty title is not a change anyone means: the board keeps its own.
    if (title === '' || title === board.title) {
      onEnd(returnFocus);
      return;
    }
    rename.mutate({ title }, { onSuccess: () => onEnd(returnFocus) });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(true);
  }

  return (
    <form className="board-title__form" onSubmit={handleSubmit}>
      <h1 id={titleId} className="visually-hidden">
        {board.title}
      </h1>
      <BoardTile boardId={board.id} title={draft} />
      <input
        className="board-title__input"
        aria-label="Board title"
        value={draft}
        maxLength={boardTitleMaxLength}
        readOnly={rename.isPending}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => cancelOnEscape(event, () => onEnd(true))}
        onBlur={() => save(false)}
      />
      <SaveState pending={rename.isPending} error={rename.error} />
    </form>
  );
}

interface BoardTileProps {
  boardId: string;
  title: string;
  small?: boolean;
}

/** The board's initial on its colour; decoration, as its title is always beside it. */
export function BoardTile({ boardId, title, small = false }: BoardTileProps) {
  return (
    <span className={small ? 'board-tile board-tile--small' : 'board-tile'} data-color={tileColor(boardId)} aria-hidden="true">
      {title.trim().charAt(0).toUpperCase() || '·'}
    </span>
  );
}

// Derived from the id, so a board keeps its colour without a field for it; gray, the neutral one, left out.
function tileColor(boardId: string): PaletteColor {
  const colors = paletteColors.filter((color) => color !== 'gray');
  const sum = [...boardId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[sum % colors.length] ?? 'coral';
}
