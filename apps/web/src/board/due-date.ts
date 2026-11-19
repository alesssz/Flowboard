// Due dates: calendar days ('YYYY-MM-DD'), compared and shown in the browser's time zone.

export type DueStatus = 'overdue' | 'today' | 'upcoming';

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fullDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' });

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** The local calendar day of `date`, as 'YYYY-MM-DD'. */
export function toCalendarDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// With a time and no offset the string is read as local time; 'YYYY-MM-DD' alone would be
// midnight UTC, the previous day west of Greenwich.
function parseCalendarDay(day: string): Date {
  return new Date(`${day}T00:00`);
}

// 'YYYY-MM-DD' strings sort like the days they name.
export function getDueStatus(dueDate: string, today: Date): DueStatus {
  const todayDay = toCalendarDay(today);
  if (dueDate < todayDay) return 'overdue';
  return dueDate === todayDay ? 'today' : 'upcoming';
}

/** 'Yesterday', 'Today', 'Tomorrow', else '20 Nov', with the year when it is not this one. */
export function formatDueDate(dueDate: string, today: Date): string {
  if (dueDate === toCalendarDay(addDays(today, -1))) return 'Yesterday';
  if (dueDate === toCalendarDay(today)) return 'Today';
  if (dueDate === toCalendarDay(addDays(today, 1))) return 'Tomorrow';
  return formatDay(parseCalendarDay(dueDate), today);
}

/** '20 Nov', with the year when it is not this one. */
export function formatDay(date: Date, today: Date): string {
  return (date.getFullYear() === today.getFullYear() ? dayMonth : dayMonthYear).format(date);
}

/** 'Friday, 20 November 2026'. */
export function formatFullDate(day: string): string {
  return fullDate.format(parseCalendarDay(day));
}
