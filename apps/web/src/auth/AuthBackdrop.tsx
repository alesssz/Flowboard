// The board drawn behind the sign-in form: a fixed picture, not data (with no session there is none to read).
import type { PaletteColor } from '@flowboard/shared';
import './AuthBackdrop.css';

interface PictureCard {
  title: string;
  label: { name: string; color: PaletteColor };
  initials: { text: string; color: PaletteColor }[];
}

const columns: { title: string; color: PaletteColor; cards: PictureCard[] }[] = [
  {
    title: 'To do',
    color: 'gray',
    cards: [
      { title: 'Write the pricing page copy', label: { name: 'Content', color: 'blue' }, initials: [{ text: 'LF', color: 'green' }, { text: 'MB', color: 'amber' }] },
      { title: 'Pick the hero illustration', label: { name: 'Design', color: 'violet' }, initials: [] },
    ],
  },
  {
    title: 'In progress',
    color: 'coral',
    cards: [
      { title: 'Navigation redesign', label: { name: 'Design', color: 'violet' }, initials: [{ text: 'AO', color: 'violet' }] },
      { title: 'Move the blog to the new CMS', label: { name: 'Content', color: 'blue' }, initials: [{ text: 'SP', color: 'blue' }] },
    ],
  },
  {
    title: 'Done',
    color: 'green',
    cards: [{ title: 'Brand colours and type scale', label: { name: 'Design', color: 'violet' }, initials: [{ text: 'AO', color: 'violet' }] }],
  },
  {
    title: 'Review',
    color: 'blue',
    cards: [{ title: 'Contact form', label: { name: 'Frontend', color: 'coral' }, initials: [{ text: 'SP', color: 'blue' }] }],
  },
  {
    title: 'Blocked',
    color: 'amber',
    cards: [{ title: 'Cookie banner', label: { name: 'Legal', color: 'amber' }, initials: [{ text: 'LF', color: 'green' }] }],
  },
];

export function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <div className="auth-backdrop__board">
        {columns.map((column) => (
          <div key={column.title} className="auth-backdrop__column" data-color={column.color}>
            <p className="auth-backdrop__title">
              {column.title} <span className="auth-backdrop__count">{column.cards.length}</span>
            </p>
            {column.cards.map((card) => (
              <div key={card.title} className="auth-backdrop__card">
                <span className="auth-backdrop__label" data-color={card.label.color}>
                  {card.label.name}
                </span>
                {card.title}
                {card.initials.length > 0 && (
                  <span className="auth-backdrop__people">
                    {card.initials.map((person) => (
                      <span key={person.text} className="auth-backdrop__avatar" data-color={person.color}>
                        {person.text}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
