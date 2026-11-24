// One entry of the card's details: its name, its value as a button, and the panel the button opens to
// change it. The panel is a native popover: it floats over the dialog, so opening it moves nothing, and the
// browser closes it on Escape or a click outside.
import { type ReactNode, type ToggleEvent, useEffect, useId, useRef, useState } from 'react';
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

/** Space kept between the panel and the window's edges, in pixels. */
const EDGE = 8;

export function DetailRow({ name, value, children, onOpen, onClose, status, note }: DetailRowProps) {
  const nameId = useId();
  const buttonId = useId();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const [open, setOpen] = useState(false);

  // Fixed to the window: it follows a resize, and closes when anything behind it scrolls.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    function handleScroll(event: Event) {
      if (panel?.matches(':popover-open') && !panel.contains(event.target as Node)) panel.hidePopover();
    }
    function handleResize() {
      if (panel?.matches(':popover-open')) place();
    }
    // Wherever the focus is: it reaches the panel only once the browser reports it open.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && panel?.matches(':popover-open')) cancelledRef.current = true;
    }
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Below the button and ending where it ends, so from the side column it opens over the dialog; above
  // the button when there is no room below; inside the window either way.
  function place() {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (button === null || panel === null) return;
    const anchor = button.getBoundingClientRect();
    const left = Math.max(EDGE, Math.min(anchor.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - EDGE));
    const below = anchor.bottom + 6;
    const top =
      below + panel.offsetHeight > window.innerHeight - EDGE ? Math.max(EDGE, anchor.top - 6 - panel.offsetHeight) : below;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function close() {
    panelRef.current?.hidePopover();
  }

  function handleBeforeToggle(event: ToggleEvent<HTMLDivElement>) {
    if (event.newState !== 'open') return;
    cancelledRef.current = false;
    onOpen?.();
  }

  function handleToggle(event: ToggleEvent<HTMLDivElement>) {
    const panel = event.currentTarget;
    setOpen(event.newState === 'open');
    if (event.newState === 'open') {
      place();
      panel.querySelector<HTMLElement>('input, button')?.focus();
      return;
    }
    // Back to the button, unless a click outside put the focus somewhere on purpose.
    if (panel.contains(document.activeElement) || document.activeElement === document.body) buttonRef.current?.focus();
    onClose?.(cancelledRef.current);
  }

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
