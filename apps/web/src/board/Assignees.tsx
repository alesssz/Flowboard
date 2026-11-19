// The people on a card: avatars with initials, then a count of the rest.
import type { Member } from '@flowboard/shared';
import { Tooltip } from '../Tooltip.tsx';
import { Avatar } from './Avatar.tsx';
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
        <li key={member.id} className="assignees__item">
          <Avatar member={member} />
          <span className="visually-hidden">{member.name}</span>
          <Tooltip text={member.name} align="end" />
        </li>
      ))}

      {restNames !== '' && (
        <li className="assignees__item">
          <span className="assignees__more" aria-hidden="true">
            +{members.length - shown.length}
          </span>
          <span className="visually-hidden">{restNames}</span>
          <Tooltip text={restNames} align="end" />
        </li>
      )}
    </ul>
  );
}
