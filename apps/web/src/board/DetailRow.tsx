// One entry of the card's details: its name, its value as a button, and the panel the button opens to
// change it (usePopoverPanel), floating over the dialog.
import { type ReactNode, useId } from 'react';
import { usePopoverPanel } from './use-popover-panel.ts';
import './DetailRow.css';

interface DetailRowProps {
  name: string;
  /** What the card has, shown in the button. */
  value: ReactNode;
  /** The panel's content; `close` hides the panel as a click outside would. */
  children: (close: () => void) => ReactNode;
  onOpen?: () => void;
  /** After the panel closes; `cancelled` when Escape closed it. */
  onClose?: (cancelled: boolean) => void;
  /** Beside the name, such as "Saved"; drawn on the name's line, so it moves nothing. */
  status?: ReactNode;
  /** Under the value: what still needs saying once the panel is closed, such as a failed save. */
  note?: ReactNode;
}

export function DetailRow({ name, value, children, onOpen, onClose, status, note }: DetailRowProps) {
  const nameId = useId();
  const buttonId = useId();
  const panelId = useId();
  const { buttonRef, panelRef, open, close, handleBeforeToggle, handleToggle } = usePopoverPanel({ onOpen, onClose });

  return (
    <div className="detail-row">
      <dt id={nameId} className="detail-row__name">
        {name}
      </dt>
      <dd className="detail-row__value">
        {status !== undefined && <div className="detail-row__status">{status}</div>}
        <button
          ref={buttonRef}
          id={buttonId}
          type="button"
          className="detail-row__button"
          popoverTarget={panelId}
          data-open={open || undefined}
          // Read as "Labels Design Frontend": the row's name, then its value.
          aria-labelledby={`${nameId} ${buttonId}`}
        >
          {value}
        </button>
        {note}
        <div
          ref={panelRef}
          id={panelId}
          popover="auto"
          className="detail-row__panel"
          role="group"
          aria-label={name}
          onBeforeToggle={handleBeforeToggle}
          onToggle={handleToggle}
        >
          {children(close)}
        </div>
      </dd>
    </div>
  );
}
