// Autosave for a card's title or description: the draft being typed, saved when the field loses the focus,
// on Enter (the title), or once typing pauses (idleDelay). Without a draft the field shows the card's value.
import type { Card } from '@flowboard/shared';
import { useEffect, useRef, useState } from 'react';
import { useUpdateCard } from './card-mutations.ts';
import { useSavedNotice } from './use-saved-notice.ts';

interface AutosaveTextOptions {
  boardId: string;
  card: Card;
  field: 'title' | 'description';
  /** Milliseconds without typing before saving; without it, only leaving the field or save() saves. */
  idleDelay?: number;
}

export function useAutosaveText({ boardId, card, field, idleDelay }: AutosaveTextOptions) {
  const update = useUpdateCard(boardId, card.id);
  const saved = card[field];
  const [draft, setDraftState] = useState<string | null>(null);
  const { justSaved, savedKey, notifySaved } = useSavedNotice();
  // Refs, as saves run from timers and from a finished request, after the render they were made in.
  const draftRef = useRef<string | null>(null);
  const savedRef = useRef(saved);
  const focusedRef = useRef(false);
  const saveAgainRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  function setDraft(next: string | null) {
    draftRef.current = next;
    setDraftState(next);
  }

  // An empty title is not a change anyone means: it is never sent, and leaving the field restores the card's.
  function isSavable(value: string): boolean {
    return value !== savedRef.current && !(field === 'title' && value === '');
  }

  function save() {
    clearTimeout(idleTimer.current);
    const value = draftRef.current?.trim();
    if (value === undefined || !isSavable(value)) return;
    // One request at a time: the draft is sent again once the running one is done.
    if (update.isPending) {
      saveAgainRef.current = true;
      return;
    }
    update.mutate(field === 'title' ? { title: value } : { description: value }, {
      onSuccess: () => {
        notifySaved();
        // The draft stays while the field has the focus, so the caret and any trailing space stay too.
        if (!focusedRef.current && draftRef.current?.trim() === value) setDraft(null);
      },
      onSettled: () => {
        if (!saveAgainRef.current) return;
        saveAgainRef.current = false;
        save();
      },
    });
  }

  function handleChange(next: string) {
    setDraft(next);
    if (idleDelay === undefined) return;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(save, idleDelay);
  }

  function handleFocus() {
    focusedRef.current = true;
  }

  function handleBlur() {
    focusedRef.current = false;
    save();
    const value = draftRef.current?.trim();
    if (value !== undefined && !isSavable(value)) setDraft(null);
  }

  /** Escape: back to the saved text. False when there was nothing to undo, so the key can close the dialog. */
  function cancel(): boolean {
    const value = draftRef.current?.trim();
    clearTimeout(idleTimer.current);
    saveAgainRef.current = false;
    setDraft(null);
    if (value === undefined || !isSavable(value)) return false;
    update.reset();
    return true;
  }

  return {
    value: draft ?? saved,
    pending: update.isPending,
    justSaved,
    savedKey,
    error: update.error,
    handleChange,
    handleFocus,
    handleBlur,
    save,
    cancel,
  };
}
