// The grip a card or a column is moved by from the keyboard: Space or Enter lifts it, the arrows move it,
// Space or Enter drops it, Escape cancels. dnd-kit's attributes and keyboard listener go on it.
import type { ButtonHTMLAttributes, Ref } from 'react';
import './DragHandle.css';

interface DragHandleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "Move Contact form": what moves, for screen readers. */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

export function DragHandle({ label, className, ...props }: DragHandleProps) {
  return (
    <button
      type="button"
      className={className === undefined ? 'drag-handle' : `drag-handle ${className}`}
      aria-label={label}
      {...props}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="6" cy="4" r="1.1" />
        <circle cx="10" cy="4" r="1.1" />
        <circle cx="6" cy="8" r="1.1" />
        <circle cx="10" cy="8" r="1.1" />
        <circle cx="6" cy="12" r="1.1" />
        <circle cx="10" cy="12" r="1.1" />
      </svg>
    </button>
  );
}
