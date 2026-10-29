import { WORDS, emailWords, loadingWords, spotsCaption } from './accountView.ts'
import type { useAccount } from './useAccount.ts'

/**
 * One line under the spot's name: the sign-in button, or the email and
 * Sign out. A caption when signed in and a failure's sentence go under it.
 * The hook is the page's, so the feedback sheet reads the same account.
 * `pending` is whether the spots have yet to reach the account.
 */
export function Account({
  account,
  signIn,
  signOut,
  warm,
  pending,
}: ReturnType<typeof useAccount> & { pending: boolean }) {
  return (
    <>
      <div className="account">
        {account.kind === 'in' ? (
          <>
            <span className="account-email">{emailWords(account.email)}</span>
            <button
              type="button"
              className="text-button account-signout"
              onClick={signOut}
            >
              {WORDS.signOut}
            </button>
          </>
        ) : account.kind === 'loading' ? (
          <button
            type="button"
            className="text-button"
            disabled
            aria-label={WORDS.loadingLabel}
          >
            {loadingWords(account.tapped)}
          </button>
        ) : (
          <button
            type="button"
            className="text-button"
            onClick={signIn}
            onPointerDown={warm}
            onFocus={warm}
          >
            {WORDS.signIn}
          </button>
        )}
      </div>
      {account.kind === 'in' && (
        <p className="caption">{spotsCaption(pending)}</p>
      )}
      {account.kind === 'failed' && (
        <p className="notice" role="alert">
          {account.words}
        </p>
      )}
    </>
  )
}
