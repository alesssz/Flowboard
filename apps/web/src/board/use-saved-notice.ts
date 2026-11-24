// "Saved" for a moment after a save: the flag that shows the badge, and the call that raises it.
import { useEffect, useRef, useState } from 'react';

/** How long "Saved" stays; the card-field-saved animation in CardFields.css lasts as long. */
const SAVED_NOTICE_MS = 2000;

export function useSavedNotice() {
  const [justSaved, setJustSaved] = useState(false);
  // Changes with every save, so the badge restarts its animation when saves follow each other.
  const [savedKey, setSavedKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function notifySaved() {
    setJustSaved(true);
    setSavedKey((key) => key + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustSaved(false), SAVED_NOTICE_MS);
  }

  return { justSaved, savedKey, notifySaved };
}
