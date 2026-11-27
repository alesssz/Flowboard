// What stands in for a page while it loads, fails or has nothing to show: a message centred in the main area.
import type { ReactNode } from 'react';
import './PageMessage.css';

interface PageMessageProps {
  title: string;
  detail?: string;
  /** Given for an error: adds a retry button, and screen readers announce the message at once. */
  onRetry?: () => void;
  /** Disables the retry button while the request runs again. */
  retrying?: boolean;
  /** Under the detail: a way on, such as a link with the class page-message__action. */
  children?: ReactNode;
}

export function PageMessage({ title, detail, onRetry, retrying = false, children }: PageMessageProps) {
  return (
    <div className="page-message" role={onRetry === undefined ? 'status' : 'alert'}>
      <p className="page-message__title">{title}</p>
      {detail !== undefined && <p className="page-message__detail">{detail}</p>}
      {children}
      {onRetry !== undefined && (
        <button type="button" className="page-message__retry" disabled={retrying} onClick={onRetry}>
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}
