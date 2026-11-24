// A text area as tall as its text: recomputed when the text changes and when its width does (a closed
// dialog has none, so the first real measure comes once it opens).
import { useEffect, useLayoutEffect, useRef } from 'react';

export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (ref.current !== null) fit(ref.current);
  }, [value]);

  useEffect(() => {
    const area = ref.current;
    if (area === null) return;
    let width = area.clientWidth;
    const observer = new ResizeObserver(() => {
      if (area.clientWidth === width) return;
      width = area.clientWidth;
      fit(area);
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function fit(area: HTMLTextAreaElement) {
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight}px`;
}
