// A card as its column shows it: the title, and the description cut to two lines.
import type { Card } from '@flowboard/shared';
import './BoardCard.css';

interface BoardCardProps {
  card: Card;
}

export function BoardCard({ card }: BoardCardProps) {
  return (
    <article className="board-card">
      <h3 className="board-card__title">{card.title}</h3>
      {card.description !== '' && <p className="board-card__description">{card.description}</p>}
    </article>
  );
}
