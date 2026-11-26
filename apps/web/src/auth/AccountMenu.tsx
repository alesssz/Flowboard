// The signed-in user in the header: their name and Sign out.
import type { User } from '@flowboard/shared';
import { useSignOut } from './auth-queries.ts';
import './AccountMenu.css';

interface AccountMenuProps {
  user: User;
}

export function AccountMenu({ user }: AccountMenuProps) {
  const signOut = useSignOut();

  function handleSignOut() {
    if (signOut.isPending) return;
    signOut.mutate();
  }

  return (
    <div className="account">
      <span className="account__name">
        <span className="visually-hidden">Signed in as </span>
        {user.name}
      </span>
      <button type="button" className="account__sign-out" aria-disabled={signOut.isPending} onClick={handleSignOut}>
        {signOut.isPending ? 'Signing out…' : 'Sign out'}
      </button>
      {signOut.error !== null && (
        <p className="account__error" role="alert">
          Not signed out: {signOut.error.message}
        </p>
      )}
    </div>
  );
}
