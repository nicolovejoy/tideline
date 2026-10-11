// The line that says which build is running: when it was made and, where
// the build knows it, from which commit. It is for the people building the
// app, not for the first user. No React here.

import { formatMonthDay, formatTime, localDate } from '../time.ts'

const REPO = 'https://github.com/nicolovejoy/tideline'

/** A full git hash. Anything else a build might hand over is not linked. */
const HASH = /^[0-9a-f]{40}$/

/** What Vite writes into the bundle as it builds. */
export interface Build {
  /** When the bundle was made, as an ISO instant. */
  builtAt: string
  /** The full hash of the commit it was made from, or '' where unknown. */
  commit: string
}

export interface BuildStamp {
  /** "Build Oct 10, 2:31 PM" */
  words: string
  commit: {
    /** The first seven characters, as GitHub shows a commit. */
    short: string
    url: string
    /** The link's name for a screen reader; seven characters say little. */
    label: string
  } | null
}

/**
 * The stamp in a zone, or null for a build whose time is not one. The zone
 * is the viewer's: this is about the build, not about a spot.
 */
export function buildStamp(build: Build, timeZone: string): BuildStamp | null {
  const t = Date.parse(build.builtAt)
  if (Number.isNaN(t)) return null
  const day = formatMonthDay(localDate(t, timeZone))
  const short = build.commit.slice(0, 7)
  return {
    words: `Build ${day}, ${formatTime(t, timeZone)}`,
    commit: HASH.test(build.commit)
      ? {
          short,
          url: `${REPO}/commit/${build.commit}`,
          label: `Commit ${short} on GitHub`,
        }
      : null,
  }
}
