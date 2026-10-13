// The words of the add screen, and whether it can save. No React here.

import { wrapLon } from '../data/geo.ts'
import type { LatLon } from '../data/geo.ts'
import type { Place } from '../data/geocode.ts'
import type {
  ResolveFailure,
  ResolveResult,
  SpotFacts,
} from '../data/resolve.ts'
// Imports nothing itself, so it brings no station code with it.
import { TIDES_WITHIN_MI } from '../data/tideRule.ts'
import type { Spot, Station } from '../spot.ts'
import { noTidesWords } from './captions.ts'

export const NAME_MAX = 40

export const WORDS = {
  heading: 'New spot',
  editHeading: 'Edit spot',
  edit: 'Edit',
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

/** Everything the spot has apart from what the user gave it. */
export function spotFacts(spot: Spot): SpotFacts {
  const { id: _id, name: _name, ...facts } = spot
  return facts
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

/**
 * Whether the pin is somewhere other than the spot, at the four decimal
 * places a spot's point is kept to. The longitude is wrapped first: a tap
 * on a world copy of the map is the same place.
 */
export function pinMoved(
  spot: Pick<Spot, 'lat' | 'lon'>,
  pin: LatLon,
): boolean {
  return (
    round4(pin.lat) !== round4(spot.lat) ||
    round4(wrapLon(pin.lon)) !== round4(spot.lon)
  )
}

/**
 * Whether the pin is a point to look up: any pin on the add screen, and
 * on the edit screen only a pin moved off the spot's own point. No pin
 * needs nothing.
 */
export function needsLookup(
  editing: Pick<Spot, 'lat' | 'lon'> | undefined,
  pin: LatLon | null,
): boolean {
  if (pin === null) return false
  return editing === undefined || pinMoved(editing, pin)
}

export type Edit =
  | { kind: 'nothing' }
  | { kind: 'rename'; spot: Spot }
  | { kind: 'move'; spot: Spot }

/**
 * What Save would do to `spot` with the screen as it stands, and the spot
 * it would save; null when it cannot save. A rename keeps the id and
 * everything looked up before. A move is a new spot under `newId`, from
 * what the look-up found for the new pin.
 */
export function edited(
  spot: Spot,
  name: string,
  pin: LatLon,
  result: ResolveResult | null,
  newId: string,
): Edit | null {
  const clean = cleanName(name)
  if (clean === '') return null
  if (pinMoved(spot, pin)) {
    if (result?.ok !== true) return null
    return { kind: 'move', spot: { ...result.facts, id: newId, name: clean } }
  }
  if (clean === spot.name) return { kind: 'nothing' }
  return { kind: 'rename', spot: { ...spot, name: clean } }
}
