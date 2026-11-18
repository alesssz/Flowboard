// A card's due date: relative words near today, amber on the day, red once past; the full date on hover.
import { formatDueDate, formatFullDate, getDueStatus } from './due-date.ts';
import './DueDate.css';

interface DueDateProps {
  /** Calendar day, 'YYYY-MM-DD'. */
  date: string;
  today: Date;
}

export function DueDate({ date, today }: DueDateProps) {
  const status = getDueStatus(date, today);

  return (
    <p className={`due-date due-date--${status}`}>
      <svg className="due-date__icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" />
      </svg>
      {/* The colour alone does not say the date is past. */}
      <span className="visually-hidden">{status === 'overdue' ? 'Overdue: ' : 'Due: '}</span>
      <time dateTime={date}>{formatDueDate(date, today)}</time>
      {/* Drawn rather than a title attribute, which some browsers and webviews never show. Hidden
          from screen readers: <time> already gives them the date. */}
      <span className="due-date__tooltip" aria-hidden="true">
        {formatFullDate(date)}
      </span>
    </p>
  );
}
