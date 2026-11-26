// The page for a browser with no session: sign in, or create an account.
import { emailMaxLength, passwordMaxLength, passwordMinLength, userNameMaxLength } from '@flowboard/shared';
import { type FormEvent, type InputHTMLAttributes, type KeyboardEvent, useRef, useState } from 'react';
import { Logo } from '../Logo.tsx';
import { Tooltip } from '../Tooltip.tsx';
import { AuthBackdrop } from './AuthBackdrop.tsx';
import { useSignIn, useSignUp } from './auth-queries.ts';
import './AuthPage.css';

type Mode = 'sign-in' | 'sign-up';
type FieldName = 'name' | 'email' | 'password';

const modes: Mode[] = ['sign-in', 'sign-up'];
const texts: Record<Mode, { tab: string; title: string; lead: string }> = {
  'sign-in': { tab: 'Sign in', title: 'Welcome back', lead: 'Sign in to pick up where you left off.' },
  'sign-up': { tab: 'Create account', title: 'Create your account', lead: 'One account for every board you work on.' },
};

/** An API message about one field ("password: must be at least 15 characters") goes under that field. */
type FormError = { field: FieldName; text: string } | { field: null; text: string };

function toFormError(message: string): FormError {
  const match = /^(name|email|password): (.+)$/s.exec(message);
  if (match === null) return { field: null, text: message };
  const [, field, text = ''] = match;
  return { field: field as FieldName, text: text.charAt(0).toUpperCase() + text.slice(1) };
}

interface AuthPageProps {
  /** The session ended while the app was in use: says so above the form. */
  sessionEnded: boolean;
}

export function AuthPage({ sessionEnded }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const tabRefs = useRef(new Map<Mode, HTMLButtonElement>());
  const signIn = useSignIn();
  const signUp = useSignUp();

  const action = mode === 'sign-in' ? signIn : signUp;
  const error = action.error === null ? null : toFormError(action.error.message);
  const fieldError = (field: FieldName) => (error?.field === field ? error.text : undefined);

  function handleError(failure: Error) {
    const { field } = toFormError(failure.message);
    if (field === null) return;
    const input = formRef.current?.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.isPending) return;
    if (mode === 'sign-in') signIn.mutate({ email, password }, { onError: handleError });
    else signUp.mutate({ name, email, password }, { onError: handleError });
  }

  function handleSelect(next: Mode) {
    if (next === mode) return;
    signIn.reset();
    signUp.reset();
    setMode(next);
  }

  // Tabs: the arrows, Home and End move between them, and select the one they reach.
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = modes.indexOf(mode);
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: modes.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = modes[(target + modes.length) % modes.length] ?? mode;
    handleSelect(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <div className="auth">
      <AuthBackdrop />
      <section className="auth__panel" aria-labelledby="auth-title">
        <p className="auth__brand">
          <Logo size={28} />
          <span>
            <span className="auth__brand-accent">Flow</span>board
          </span>
        </p>

        {sessionEnded && (
          <p className="auth__notice" role="status">
            Your session has ended. Sign in again to go on.
          </p>
        )}

        <div className="auth__tabs" role="tablist" aria-label="Account">
          {modes.map((tab) => (
            <button
              key={tab}
              ref={(element) => {
                if (element === null) tabRefs.current.delete(tab);
                else tabRefs.current.set(tab, element);
              }}
              type="button"
              role="tab"
              id={`auth-tab-${tab}`}
              className="auth__tab"
              aria-selected={tab === mode}
              aria-controls="auth-form"
              tabIndex={tab === mode ? 0 : -1}
              onClick={() => handleSelect(tab)}
              onKeyDown={handleTabKeyDown}
            >
              {texts[tab].tab}
            </button>
          ))}
        </div>

        <form
          ref={formRef}
          id="auth-form"
          role="tabpanel"
          aria-labelledby={`auth-tab-${mode}`}
          className="auth__form"
          onSubmit={handleSubmit}
        >
          <div className="auth__heading">
            <h1 id="auth-title" className="auth__title">
              {texts[mode].title}
            </h1>
            <p className="auth__lead">{texts[mode].lead}</p>
          </div>

          {mode === 'sign-up' && (
            <AuthField
              name="name"
              label="Name"
              autoComplete="name"
              required
              maxLength={userNameMaxLength}
              value={name}
              readOnly={action.isPending}
              error={fieldError('name')}
              onChange={(event) => setName(event.target.value)}
            />
          )}
          <AuthField
            name="email"
            label="Email"
            type="email"
            // "username": password managers save the password under this field.
            autoComplete="username"
            placeholder="you@example.com"
            required
            maxLength={emailMaxLength}
            // On the first render only: switching tabs keeps the focus on the tabs.
            autoFocus
            value={email}
            readOnly={action.isPending}
            error={fieldError('email')}
            onChange={(event) => setEmail(event.target.value)}
          />
          <AuthField
            name="password"
            label="Password"
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            required
            // Only at sign-up: a password set under an older, shorter minimum must still sign in.
            minLength={mode === 'sign-up' ? passwordMinLength : undefined}
            maxLength={passwordMaxLength}
            value={password}
            readOnly={action.isPending}
            hint={
              mode === 'sign-up'
                ? `At least ${passwordMinLength} characters. A few unrelated words make a long password that is easy to remember.`
                : undefined
            }
            error={fieldError('password')}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error?.field === null && (
            <p className="auth__error" role="alert">
              {error.text}
            </p>
          )}

          <button type="submit" className="auth__submit" aria-disabled={action.isPending}>
            {mode === 'sign-in'
              ? signIn.isPending
                ? 'Signing in…'
                : 'Sign in'
              : signUp.isPending
                ? 'Creating the account…'
                : 'Create account'}
            {!action.isPending && (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: FieldName;
  label: string;
  /** Shown under the field, and read with it by screen readers. */
  hint?: string;
  /** The API's message about this field: marks it invalid and is announced. */
  error?: string;
}

function AuthField({ name, label, hint, error, type, ...input }: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const id = `auth-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <div className="auth__field">
      <label className="auth__label" htmlFor={id}>
        {label}
      </label>
      <div className="auth__control">
        <input
          {...input}
          id={id}
          name={name}
          type={type === 'password' && revealed ? 'text' : type}
          className="auth__input"
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
        />
        {type === 'password' && (
          <button
            type="button"
            className="auth__reveal"
            aria-label="Show password"
            aria-pressed={revealed}
            onClick={() => setRevealed(!revealed)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
              <circle cx="8" cy="8" r="2" />
              {revealed && <path d="M2.5 2.5l11 11" />}
            </svg>
            <Tooltip text={revealed ? 'Hide password' : 'Show password'} align="end" />
          </button>
        )}
      </div>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="auth__hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="auth__field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
