// A card as its column shows it: labels, title, and the description cut to two lines.
import type { Card } from '@flowboard/shared';
import './BoardCard.css';

interface BoardCardProps {
  card: Card;
}

export function BoardCard({ card }: BoardCardProps) {
  // The stripe takes the first label's colour; a card without labels has none.
  const stripeColor = card.labels[0]?.color;

  return (
    <article className="board-card" data-color={stripeColor}>
      {/* First in the markup, so a screen reader reads the title before the labels shown above it. */}
      <h3 className="board-card__title">{card.title}</h3>

      {card.labels.length > 0 && (
        <ul className="board-card__labels" aria-label="Labels">
          {card.labels.map((label) => (
            <li key={label.id} className="board-card__label" data-color={label.color}>
              {label.name}
            </li>
          ))}
        </ul>
      )}

      {card.description !== '' && <p className="board-card__description">{card.description}</p>}
    </article>
  );
}
