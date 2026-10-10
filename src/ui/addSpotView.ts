// The words of the add screen, and whether it can save. No React here.

import type { LatLon } from '../data/geo.ts'
import type { Place } from '../data/geocode.ts'
import type {
  ResolveFailure,
  ResolveResult,
  SpotFacts,
} from '../data/resolve.ts'
// Imports nothing itself, so it brings no station code with it.
import { TIDES_WITHIN_MI } from '../data/tideRule.ts'
import type { Station } from '../spot.ts'
import { noTidesWords } from './captions.ts'

export const NAME_MAX = 40

export const WORDS = {
  heading: 'New spot',
  addSpot: 'Add a spot',
  locate: 'Use my location',
  locating: 'Finding you…',
  locateFailed: "Couldn't get your location. Tap the map instead.",
  placeLabel: 'Place',
  search: 'Search',
  searching: 'Searching…',
  noPlace: 'No place by that name in the US.',
  searchFailed: "Couldn't reach the place search. Try again in a minute.",
  mapLabel: 'Map. Tap to drop a pin.',
  tapToStart: 'Tap the map to drop a pin, or use your location.',
  looking: 'Looking up the forecast and the nearest stations…',
  nameLabel: 'Name',
  pinOnShore: 'For a tide, put the pin on the shore.',
  save: 'Save',
  cancel: 'Cancel',
  tryAgain: 'Try again',
  loadingMap: 'Loading the map…',
  addUnavailable:
    "Couldn't load the map. Check the connection and reload the page.",
  notKept:
    "Couldn't save this spot on the device: its storage is full. The spot is here until the page is next opened.",
  remove: 'Remove this spot',
  removeYes: 'Yes, remove',
  removeNo: 'Keep',
  separator: '·',
} as const

/** OpenStreetMap's standard tiles, and the credit their policy asks for. */
export const MAP = {
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Search by <a href="https://nominatim.org">Nominatim</a>',
} as const

const feet = (ft: number) => `${ft.toLocaleString('en-US')} ft`

function stationWords(station: Station): string {
  return `NOAA ${station.id} ${station.name}, ${station.distanceMi} mi ${station.direction}`
}

/**
 * What this spot gets, a line each: its forecast cell, its own height
 * where USGS gave one, then its tide station and gauge, or in their place
 * the one line saying why it has no tide.
 */
export function factsLines(facts: SpotFacts): string[] {
  const { nws, tideStation, gauge } = facts
  const lines = [
    `Weather: NWS cell ${nws.office} ${nws.gridX},${nws.gridY}, ${feet(nws.elevationFt)}, ${facts.timeZone}.`,
  ]
  if (facts.elevationFt !== null) {
    lines.push(`Height: ${feet(facts.elevationFt)} above sea level, from USGS.`)
  }
  const none = noTidesWords(facts)
  if (none !== null) {
    // Near a station it is the spot's height that rules the tide out, and
    // the pin can be moved: a search for a beach can land in the hills
    // behind it. Far from any station there is nowhere to move it to.
    const near = tideStation.distanceMi <= TIDES_WITHIN_MI
    return [...lines, near ? `${none} ${WORDS.pinOnShore}` : none]
  }

  const curve =
    tideStation.type === 'harmonic'
      ? '6-minute curve.'
      : 'Highs and lows only; the curve will be interpolated.'
  return [
    ...lines,
    `Tide: ${stationWords(tideStation)}. ${curve}`,
    gauge.id === tideStation.id
      ? 'Gauge: its own.'
      : `Gauge: ${stationWords(gauge)}.`,
  ]
}

export function failureWords(reason: ResolveFailure): string {
  switch (reason) {
    case 'outside':
      return 'NWS has no forecast here. Tideline covers the US.'
    case 'unreachable':
      return "Couldn't reach the National Weather Service. Try again in a minute."
  }
}

export function cleanName(raw: string): string {
  return raw.trim().slice(0, NAME_MAX)
}

export type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; place: Place }
  | { status: 'none' }
  | { status: 'failed' }

/** The line under the search row: what was found, or why nothing was. */
export function searchLine(state: SearchState): string | null {
  switch (state.status) {
    case 'idle':
    case 'searching':
      return null
    case 'found':
      return state.place.displayName
    case 'none':
      return WORDS.noPlace
    case 'failed':
      return WORDS.searchFailed
  }
}

/** The name field after a search: what was typed, or the place's name for a blank. */
export function suggestedName(typed: string, place: Place): string {
  return cleanName(typed) === '' ? cleanName(place.name) : typed
}

export function canSave(
  pin: LatLon | null,
  name: string,
  result: ResolveResult | null,
): boolean {
  return pin !== null && cleanName(name) !== '' && result?.ok === true
}

/** Whether the search button can fire: something typed, and no search in flight. */
export function canSearch(query: string, search: SearchState): boolean {
  return query.trim() !== '' && search.status !== 'searching'
}

export function removeQuestion(name: string): string {
  return `Remove ${name}?`
}
