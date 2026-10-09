// Whether to point at Share, then Add to Home Screen. iOS has no install
// prompt of its own, so the hint is ours. It is shown only where those words
// are true: Safari on an iPhone or iPad, in the browser rather than from the
// home screen. Plain functions; the component only arranges them.

/** What the hint's rule needs to know about the browser. */
export interface BrowserEnv {
  userAgent: string
  /** iPadOS calls itself a Mac. A Mac has no touch points; an iPad has. */
  maxTouchPoints: number
  /** Opened from the home screen, without the browser's bars. */
  standalone: boolean
}

export function wantsInstallHint(env: BrowserEnv): boolean {
  if (env.standalone) return false
  const ua = env.userAgent
  const iPhoneOrIPad = /iPhone|iPad/.test(ua)
  const iPadAsMac = /Macintosh/.test(ua) && env.maxTouchPoints > 1
  if (!iPhoneOrIPad && !iPadAsMac) return false
  // Every iOS browser is WebKit, and most add "Safari" to their user agent.
  // The ones that are not Safari add their own name as well. An app's web
  // view adds nothing, and has no Share menu to point at.
  const safari = /Safari\//.test(ua)
  const another = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|Brave/.test(
    ua,
  )
  return safari && !another
}

/** What the browser says about itself, for `wantsInstallHint`. */
export function browserEnv(): BrowserEnv {
  const nav = navigator as Navigator & { standalone?: boolean }
  let standalone = nav.standalone === true
  try {
    standalone ||= matchMedia('(display-mode: standalone)').matches
  } catch {
    // No matchMedia. Safari has it; nothing else shows the hint anyway.
  }
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone,
  }
}

const KEY = 'tideline:install-hint:dismissed'

/** Whether the hint has been dismissed on this device. */
export function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    // Storage is disabled. The hint shows again; that is the lesser harm.
    return false
  }
}

export function writeDismissed(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Storage is full or disabled. The hint goes for this open at least.
  }
}
