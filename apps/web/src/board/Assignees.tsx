// The people on a card: avatars with initials, then a count of the rest.
import type { Member } from '@flowboard/shared';
import { Tooltip } from '../Tooltip.tsx';
import './Assignees.css';

interface AssigneesProps {
  members: Member[];
}

const maxAvatars = 3;

export function Assignees({ members }: AssigneesProps) {
  // Past the limit the last slot shows the count, so the row is never wider than three avatars.
  const shown = members.length > maxAvatars ? members.slice(0, maxAvatars - 1) : members;
  const restNames = members
    .slice(shown.length)
    .map((member) => member.name)
    .join(', ');

  return (
    <ul className="assignees" aria-label="Assignees">
      {shown.map((member) => (
        <li key={member.id} className="assignees__avatar" data-color={member.color}>
          <span aria-hidden="true">{initials(member.name)}</span>
          <span className="visually-hidden">{member.name}</span>
          <Tooltip text={member.name} align="end" />
        </li>
      ))}

      {restNames !== '' && (
        <li className="assignees__avatar assignees__avatar--more">
          <span aria-hidden="true">+{members.length - shown.length}</span>
          <span className="visually-hidden">{restNames}</span>
          <Tooltip text={restNames} align="end" />
        </li>
      )}
    </ul>
  );
}

/** 'Ada Okafor' → 'AO'; a single name gives one letter. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words.at(-1) ?? '') : '';
  // Array.from splits by code point, so a letter outside the BMP is not cut in half.
  return ((Array.from(first)[0] ?? '') + (Array.from(last)[0] ?? '')).toUpperCase();
}
