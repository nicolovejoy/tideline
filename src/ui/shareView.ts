// A spot as a link: the link for a spot, and what a page opened with one
// is to show. The link carries a name and a place and nothing else; the
// rest is looked up when it is opened, as for a new pin. No React here.

import type { LatLon } from '../data/geo.ts'
import type { ResolveResult } from '../data/resolve.ts'
import type { Spot } from '../spot.ts'
import { WORDS, cleanName, failureWords } from './addSpotView.ts'

export const SHARE = {
  share: 'Share this spot',
  copied: 'Link copied.',
  copyThis: 'Copy this link:',
  notice: 'Shared with you. Not saved on this device.',
  close: 'Close',
  /** A link with a place and no name. */
  name: 'Shared spot',
  // A link's point is looked up as a pin on the add screen is, in the same
  // words.
  save: WORDS.save,
  looking: WORDS.looking,
  tryAgain: WORDS.tryAgain,
} as const

/**
 * Four places, about 35 ft: what is kept of a pin when a spot is added.
 * Adding 0 makes a rounded -0 a plain 0.
 */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4 + 0

/** What a link carries. */
export interface SharedPoint extends LatLon {
  name: string
}

/**
 * The link for a spot. The name comes first so the link ends in a digit: a
 * name can end in a bracket or a full stop, which a message app may leave
 * out of the link.
 */
export function shareUrl(spot: Spot, origin: string): string {
  const query = new URLSearchParams({
    name: spot.name,
    at: `${round4(spot.lat)},${round4(spot.lon)}`,
  })
  return `${origin}/?${query}`
}

/** Two plain decimal numbers and one comma: no exponent, no spaces. */
const AT = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/

/**
 * What a page's query string asks for, or null where it is not a link to a
 * place on Earth. A place with no name is still a spot.
 */
export function parseShareLink(search: string): SharedPoint | null {
  const query = new URLSearchParams(search)
  const at = AT.exec(query.get('at') ?? '')
  if (!at) return null
  const lat = Number(at[1])
  const lon = Number(at[2])
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const east = round4(lon)
  return {
    name: cleanName(query.get('name') ?? '') || SHARE.name,
    lat: round4(lat),
    // The same meridian, and the one a spot is added with (`wrapLon`), so
    // the spot saved from a link is the one that link finds next time.
    lon: east === 180 ? -180 : east,
  }
}

/** The spot at that point to four places, if the device has one. */
export function spotAt(spots: Spot[], point: LatLon): Spot | undefined {
  const lat = round4(point.lat)
  const lon = round4(point.lon)
  return spots.find(
    (spot) => round4(spot.lat) === lat && round4(spot.lon) === lon,
  )
}

/**
 * What the page was opened with: no link, a link to a spot the device has,
 * or one to a point it has no spot at.
 */
export type OpenedLink =
  | { kind: 'none' }
  | { kind: 'have'; spot: Spot }
  | { kind: 'new'; point: SharedPoint }

/**
 * One spot per point: a link to a point the device has a spot at opens
 * that spot, under the name it already has there.
 */
export function openedLink(search: string, spots: Spot[]): OpenedLink {
  const point = parseShareLink(search)
  if (!point) return { kind: 'none' }
  const spot = spotAt(spots, point)
  return spot ? { kind: 'have', spot } : { kind: 'new', point }
}

/**
 * The id of a spot opened from a link, made from its place: a reload before
 * saving finds the data fetched the first time, and a spot saved from a
 * link keeps the id. No hard-coded spot has it, and `newSpotId` makes none
 * like it.
 */
export function sharedSpotId(point: LatLon): string {
  return `shared-${round4(point.lat)},${round4(point.lon)}`
}

export interface LookupLine {
  words: string
  /** Whether asking again could end differently. */
  tryAgain: boolean
}

const UNREACHABLE: LookupLine = {
  words: failureWords('unreachable'),
  tryAgain: true,
}

/**
 * The line under the notice while a link's point has no spot to draw:
 * looking, or why not. Null once it has one. The station list is a chunk
 * of its own and can fail to arrive like any fetch; that reads as NWS not
 * answering does, and can be tried again the same way.
 */
export function lookupLine(
  stationsFailed: boolean,
  result: ResolveResult | null,
): LookupLine | null {
  if (stationsFailed) return UNREACHABLE
  if (result === null) return { words: SHARE.looking, tryAgain: false }
  if (result.ok) return null
  return result.reason === 'unreachable'
    ? UNREACHABLE
    : { words: failureWords(result.reason), tryAgain: false }
}

/**
 * What a browser has for handing a link on. `navigator` is one. An iPhone
 * has a share sheet; many desktop browsers have only the clipboard, and a
 * page not served over https has neither.
 */
export interface ShareDevice {
  share?: (data: { title: string; url: string }) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/**
 * What became of a link, for the share line to say.
 * - sheet: the share sheet had it, shared from or closed. The line says
 *   nothing; the sheet was its own answer.
 * - copied: it is on the clipboard.
 * - show: neither could be done, so the link is shown to be copied by hand.
 */
export type Handed = 'sheet' | 'copied' | 'show'

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

/**
 * Hands the link on the best way the device has: its share sheet, then its
 * clipboard, then the reader's own hand. Never rejects. Each is called on
 * the object it belongs to, which a browser insists on.
 */
export async function handOver(
  device: ShareDevice,
  title: string,
  url: string,
): Promise<Handed> {
  if (typeof device.share === 'function') {
    try {
      await device.share({ title, url })
      return 'sheet'
    } catch (error) {
      // Closing the sheet without sharing is a choice, not a failure.
      if (isAbort(error)) return 'sheet'
    }
  }
  try {
    if (!device.clipboard) return 'show'
    await device.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'show'
  }
}
