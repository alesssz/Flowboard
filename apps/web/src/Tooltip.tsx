// A short text shown above its parent while the pointer is over it; the parent needs position: relative.
import './Tooltip.css';

interface TooltipProps {
  text: string;
  /** Edge of the parent the tooltip lines up with; 'end' near a right-hand edge, where it would be clipped. */
  align?: 'start' | 'end';
}

// Drawn rather than a title attribute, which some browsers and webviews never show. Hidden from
// screen readers: the parent has to carry the same information as text.
export function Tooltip({ text, align = 'start' }: TooltipProps) {
  return (
    <span className={`tooltip tooltip--${align}`} aria-hidden="true">
      {text}
    </span>
  );
}
