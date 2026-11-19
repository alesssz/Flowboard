// A card as its column shows it: labels, title, the description cut to two lines, then a footer with
// due date, comment count and assignees. A click anywhere on it opens its detail.
import type { Card } from '@flowboard/shared';
import { Tooltip } from '../Tooltip.tsx';
import { Assignees } from './Assignees.tsx';
import { DueDate } from './DueDate.tsx';
import { Labels } from './Labels.tsx';
import './BoardCard.css';

interface BoardCardProps {
  card: Card;
  onOpen: () => void;
}

export function BoardCard({ card, onOpen }: BoardCardProps) {
  // The stripe takes the first label's colour; a card without labels has none.
  const stripeColor = card.labels[0]?.color;
  const commentLabel = `${card.commentCount} ${card.commentCount === 1 ? 'comment' : 'comments'}`;
  const hasFooter = card.dueDate !== null || card.commentCount > 0 || card.assignees.length > 0;

  return (
    <article className="board-card" data-color={stripeColor} onClick={onOpen}>
      {/* First in the markup, so a screen reader reads the title before the labels shown above it.
          The button is the way in for the keyboard and screen readers; its click bubbles to the card. */}
      <h3 className="board-card__title">
        <button type="button" className="board-card__open" aria-haspopup="dialog">
          {card.title}
        </button>
      </h3>

      {card.labels.length > 0 && <Labels labels={card.labels} className="board-card__labels" />}

      {card.description !== '' && <p className="board-card__description">{card.description}</p>}

      {hasFooter && (
        <div className="board-card__footer">
          {card.dueDate !== null && <DueDate date={card.dueDate} today={new Date()} />}
          {card.commentCount > 0 && (
            <p className="board-card__comments">
              <svg className="board-card__comments-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
              </svg>
              <span aria-hidden="true">{card.commentCount}</span>
              <span className="visually-hidden">{commentLabel}</span>
              <Tooltip text={commentLabel} />
            </p>
          )}
          {card.assignees.length > 0 && <Assignees members={card.assignees} />}
        </div>
      )}
    </article>
  );
}
