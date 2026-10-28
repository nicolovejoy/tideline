import { WORDS, emailWords, loadingWords } from './accountView.ts'
import { useAccount } from './useAccount.ts'

/**
 * One line under the spot's name: the sign-in button, or the email and
 * Sign out. A caption when signed in and a failure's sentence go under it.
 */
export function Account() {
  const { account, signIn, signOut, warm } = useAccount()
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
      {account.kind === 'in' && <p className="caption">{WORDS.spotsStay}</p>}
      {account.kind === 'failed' && (
        <p className="notice" role="alert">
          {account.words}
        </p>
      )}
    </>
  )
}
