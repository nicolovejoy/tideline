import { useState } from 'react'
import {
  browserEnv,
  readDismissed,
  wantsInstallHint,
  writeDismissed,
} from './installHint.ts'

/**
 * One line pointing at Share, then Add to Home Screen, for iPhone and iPad
 * Safari. Dismissing it is remembered on the device.
 */
export function InstallHint() {
  const [shown, setShown] = useState(
    () => wantsInstallHint(browserEnv()) && !readDismissed(),
  )
  if (!shown) return null
  const dismiss = () => {
    writeDismissed()
    setShown(false)
  }
  return (
    <aside className="install-hint" aria-label="Add to home screen">
      <p>
        Add Tideline to your home screen: tap Share, then Add to Home Screen.
      </p>
      <button type="button" className="install-hint-dismiss" onClick={dismiss}>
        Dismiss
      </button>
    </aside>
  )
}
