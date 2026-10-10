import { describe, expect, test } from 'vitest'
import {
  MAP,
  NAME_MAX,
  WORDS,
  canSave,
  cleanName,
  factsLines,
  failureWords,
  removeQuestion,
  searchLine,
  suggestedName,
  tidesOffReason,
} from './addSpotView.ts'
import type { SpotFacts } from '../data/resolve.ts'
import type { Place } from '../data/geocode.ts'

const CAMPUS: SpotFacts = {
  lat: 34.4046,
  lon: -119.844,
  timeZone: 'America/Los_Angeles',
  elevationFt: null,
  nws: { office: 'LOX', gridX: 100, gridY: 71, elevationFt: 3 },
  tideStation: {
    id: '9411340',
    name: 'Santa Barbara',
    distanceMi: 8.6,
    direction: 'east',
    type: 'harmonic',
  },
  gauge: {
    id: '9411340',
    name: 'Santa Barbara',
    distanceMi: 8.6,
    direction: 'east',
    type: 'harmonic',
  },
  tidesShown: true,
}
const GAVIOTA: SpotFacts = {
  ...CAMPUS,
  nws: { office: 'LOX', gridX: 87, gridY: 76, elevationFt: 0 },
  tideStation: {
    id: '9411399',
    name: 'Gaviota State Park, Pacific Ocean',
    distanceMi: 0.2,
    direction: 'south',
    type: 'harmonic',
  },
  gauge: { ...CAMPUS.gauge, distanceMi: 31 },
}
const VENTURA_WAY: SpotFacts = {
  ...CAMPUS,
  tideStation: {
    id: '9411189',
    name: 'Ventura',
    distanceMi: 1.4,
    direction: 'south',
    type: 'subordinate',
  },
  gauge: { ...CAMPUS.gauge, distanceMi: 26, direction: 'west' },
}
const PEAK: SpotFacts = {
  ...CAMPUS,
  nws: { office: 'LOX', gridX: 105, gridY: 74, elevationFt: 3258 },
  tidesShown: false,
}
const LAKE: SpotFacts = {
  ...CAMPUS,
  tideStation: { ...CAMPUS.tideStation, distanceMi: 636 },
  tidesShown: false,
}

describe('factsLines', () => {
  test('a spot with its own gauge and a curve', () => {
    expect(factsLines(CAMPUS)).toEqual({
      weather: 'Weather: NWS cell LOX 100,71, 3 ft, America/Los_Angeles.',
      tide: 'Tide: NOAA 9411340 Santa Barbara, 8.6 mi east. 6-minute curve.',
      gauge: 'Gauge: its own.',
    })
  })
  test('a gauge elsewhere, and a cell at 0 ft', () => {
    const lines = factsLines(GAVIOTA)
    expect(lines.weather).toBe(
      'Weather: NWS cell LOX 87,76, 0 ft, America/Los_Angeles.',
    )
    expect(lines.gauge).toBe('Gauge: NOAA 9411340 Santa Barbara, 31 mi east.')
  })
  test('a subordinate station says its curve will be interpolated', () => {
    expect(factsLines(VENTURA_WAY).tide).toBe(
      'Tide: NOAA 9411189 Ventura, 1.4 mi south. Highs and lows only; the curve will be interpolated.',
    )
  })
  test('thousands of feet get a separator', () => {
    expect(factsLines(PEAK).weather).toBe(
      'Weather: NWS cell LOX 105,74, 3,258 ft, America/Los_Angeles.',
    )
  })
})

describe('tidesOffReason', () => {
  test('nothing where tides are on', () => {
    expect(tidesOffReason(CAMPUS)).toBeNull()
  })
  test('the height, where the cell is high', () => {
    expect(tidesOffReason(PEAK)).toBe('Off to start: the cell is 3,258 ft up.')
  })
  test('the distance, where the station is far', () => {
    expect(tidesOffReason(LAKE)).toBe(
      'Off to start: the nearest station is 636 mi away.',
    )
  })
  test('both: the distance comes first', () => {
    const both = { ...LAKE, nws: PEAK.nws }
    expect(tidesOffReason(both)).toBe(
      'Off to start: the nearest station is 636 mi away.',
    )
  })
})

describe('failureWords', () => {
  test('outside and unreachable', () => {
    expect(failureWords('outside')).toBe(
      'NWS has no forecast here. Tideline covers the US.',
    )
    expect(failureWords('unreachable')).toBe(
      "Couldn't reach the National Weather Service. Try again in a minute.",
    )
  })
})

describe('cleanName and canSave', () => {
  test('trims and cuts to 40 characters', () => {
    expect(cleanName('  Leadbetter Beach ')).toBe('Leadbetter Beach')
    expect(cleanName('x'.repeat(50))).toHaveLength(NAME_MAX)
  })
  test('save needs a pin, a name and the facts', () => {
    const pin = { lat: 34.4, lon: -119.8 }
    const ok = { ok: true as const, facts: CAMPUS }
    expect(canSave(pin, 'Leadbetter', ok)).toBe(true)
    expect(canSave(null, 'Leadbetter', ok)).toBe(false)
    expect(canSave(pin, '   ', ok)).toBe(false)
    expect(canSave(pin, 'Leadbetter', null)).toBe(false)
    expect(canSave(pin, 'Leadbetter', { ok: false, reason: 'outside' })).toBe(
      false,
    )
  })
})

describe('removeQuestion', () => {
  test('names the spot', () => {
    expect(removeQuestion('Leadbetter Beach')).toBe('Remove Leadbetter Beach?')
  })
})

describe('WORDS', () => {
  test('the line shown when the add screen could not be loaded', () => {
    expect(WORDS.addUnavailable).toBe(
      "Couldn't load the map. Check the connection and reload the page.",
    )
  })
  test('the separator on the remove line', () => {
    expect(WORDS.separator).toBe('·')
  })
})

const SANTA_BARBARA: Place = {
  lat: 34.4221319,
  lon: -119.702667,
  name: 'Santa Barbara',
  displayName: 'Santa Barbara, Santa Barbara County, California, United States',
  bounds: { south: 34.336, north: 34.464, west: -119.86, east: -119.64 },
}

describe('searchLine', () => {
  test('nothing before a search, and nothing while one runs', () => {
    expect(searchLine({ status: 'idle' })).toBeNull()
    expect(searchLine({ status: 'searching' })).toBeNull()
  })
  test('the full name of what was found', () => {
    expect(searchLine({ status: 'found', place: SANTA_BARBARA })).toBe(
      'Santa Barbara, Santa Barbara County, California, United States',
    )
  })
  test('the two failures', () => {
    expect(searchLine({ status: 'none' })).toBe(WORDS.noPlace)
    expect(searchLine({ status: 'failed' })).toBe(WORDS.searchFailed)
  })
})

describe('suggestedName', () => {
  test("a typed name stays, the place's fills a blank", () => {
    expect(suggestedName('My beach', SANTA_BARBARA)).toBe('My beach')
    expect(suggestedName('', SANTA_BARBARA)).toBe('Santa Barbara')
    expect(suggestedName('   ', SANTA_BARBARA)).toBe('Santa Barbara')
  })
  test("the place's name is cut to the limit", () => {
    const long = { ...SANTA_BARBARA, name: 'x'.repeat(60) }
    expect(suggestedName('', long)).toHaveLength(NAME_MAX)
  })
})

describe('MAP', () => {
  test("OpenStreetMap's tiles and their credit", () => {
    expect(MAP.tiles).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(MAP.attribution).toBe(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Search by <a href="https://nominatim.org">Nominatim</a>',
    )
  })
  test('credits OpenStreetMap and Nominatim', () => {
    expect(MAP.attribution).toContain('OpenStreetMap')
    expect(MAP.attribution).toContain('Nominatim')
  })
})
