// A member's initials in a circle of their colour. Hidden from screen readers: the caller gives the name as text.
import type { Member } from '@flowboard/shared';
import './Avatar.css';

interface AvatarProps {
  member: Member;
  size?: 'small' | 'medium';
}

export function Avatar({ member, size = 'small' }: AvatarProps) {
  return (
    <span className={`avatar avatar--${size}`} data-color={member.color} aria-hidden="true">
      {initials(member.name)}
    </span>
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
