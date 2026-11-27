// A panel opened by a button, as a native popover (popover="auto" on the panel, popoverTarget on the
// button): it floats over the page, so opening it moves nothing, and the browser closes it on Escape or a
// click outside. This adds what the browser leaves out: its place under the button, the focus moved into
// it and back, and whether Escape closed it.
import { type ToggleEvent, useEffect, useRef, useState } from 'react';

interface PopoverPanelOptions {
  /** The panel's edge lined up with the button's: 'end' (the default) for buttons at the right of their row. */
  align?: 'start' | 'end';
  onOpen?: () => void;
  /** After the panel closes; `cancelled` when Escape closed it. */
  onClose?: (cancelled: boolean) => void;
}

/** Space kept between the panel and the window's edges, in pixels. */
const EDGE = 8;

export function usePopoverPanel({ align = 'end', onOpen, onClose }: PopoverPanelOptions = {}) {
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
      if (panel?.matches(':popover-open') && buttonRef.current !== null) placePanel(panel, buttonRef.current, align);
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
  }, [align]);

  /** Hides the panel as a click outside would. */
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
      if (buttonRef.current !== null) placePanel(panel, buttonRef.current, align);
      panel.querySelector<HTMLElement>('a[href], input, button, select')?.focus();
      return;
    }
    // Back to the button, unless a click outside put the focus somewhere on purpose.
    if (panel.contains(document.activeElement) || document.activeElement === document.body) buttonRef.current?.focus();
    onClose?.(cancelledRef.current);
  }

  return { buttonRef, panelRef, open, close, handleBeforeToggle, handleToggle };
}

// Below the button and lined up with its end or its start, or above it when there is no room below;
// inside the window either way.
function placePanel(panel: HTMLElement, button: HTMLElement, align: 'start' | 'end'): void {
  const anchor = button.getBoundingClientRect();
  const wanted = align === 'start' ? anchor.left : anchor.right - panel.offsetWidth;
  const left = Math.max(EDGE, Math.min(wanted, window.innerWidth - panel.offsetWidth - EDGE));
  const below = anchor.bottom + 6;
  const top = below + panel.offsetHeight > window.innerHeight - EDGE ? Math.max(EDGE, anchor.top - 6 - panel.offsetHeight) : below;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}
