// A card's due date: relative words near today, amber on the day, red once past, green once the card is
// completed, whenever it was due; the full date on hover.
import { Tooltip } from '../Tooltip.tsx';
import { formatDueDate, formatFullDate, getDueStatus } from './due-date.ts';
import './DueDate.css';

interface DueDateProps {
  /** Calendar day, 'YYYY-MM-DD'. */
  date: string;
  today: Date;
  /** span inside phrasing content, such as a button. */
  as?: 'p' | 'span';
  /** The card is completed: never overdue. */
  completed?: boolean;
}

export function DueDate({ date, today, as: Tag = 'p', completed = false }: DueDateProps) {
  const status = completed ? 'done' : getDueStatus(date, today);

  return (
    <Tag className={`due-date due-date--${status}`}>
      <svg className="due-date__icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" />
      </svg>
      {/* The colour alone does not say the date is past. */}
      <span className="visually-hidden">{status === 'done' ? 'Completed, was due: ' : status === 'overdue' ? 'Overdue: ' : 'Due: '}</span>
      <time dateTime={date}>{formatDueDate(date, today)}</time>
      <Tooltip text={formatFullDate(date)} />
    </Tag>
  );
}
