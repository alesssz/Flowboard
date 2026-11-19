// A card's labels as coloured pills, in display order.
import type { Label } from '@flowboard/shared';
import './Labels.css';

interface LabelsProps {
  labels: Label[];
  /** Extra class for the list, placing it in the parent's layout. */
  className?: string;
}

export function Labels({ labels, className }: LabelsProps) {
  return (
    <ul className={className === undefined ? 'labels' : `labels ${className}`} aria-label="Labels">
      {labels.map((label) => (
        <li key={label.id} className="labels__item" data-color={label.color}>
          {label.name}
        </li>
      ))}
    </ul>
  );
}
