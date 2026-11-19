// When a comment was written: relative while recent, then the day.
import { addDays, formatDay, toCalendarDay } from './due-date.ts';

const fullDateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' });

/** 'Just now', '12 min ago', '3 h ago' (same day), 'Yesterday', else '16 Nov'. */
export function formatCommentTime(createdAt: string, now: Date): string {
  const date = new Date(createdAt);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  // Also covers a timestamp slightly ahead of the browser's clock.
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (toCalendarDay(date) === toCalendarDay(now)) return `${Math.floor(minutes / 60)} h ago`;
  if (toCalendarDay(date) === toCalendarDay(addDays(now, -1))) return 'Yesterday';
  return formatDay(date, now);
}

/** 'Wednesday, 18 November 2026 at 09:30', in the browser's time zone. */
export function formatFullDateTime(createdAt: string): string {
  return fullDateTime.format(new Date(createdAt));
}
