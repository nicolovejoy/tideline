import { describe, expect, test } from 'vitest'
import {
  MAP,
  NAME_MAX,
  WORDS,
  canSave,
  canSearch,
  cleanName,
  edited,
  factsLines,
  failureWords,
  pinMoved,
  removeQuestion,
  searchLine,
  spotFacts,
  suggestedName,
} from './addSpotView.ts'
import type { SpotFacts } from '../data/resolve.ts'
import type { Place } from '../data/geocode.ts'
import { CAMPUS_POINT } from '../spot.ts'
import type { Spot } from '../spot.ts'

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
  elevationFt: 3997,
  nws: { office: 'LOX', gridX: 105, gridY: 74, elevationFt: 3258 },
}
const LAKE: SpotFacts = {
  ...CAMPUS,
  tideStation: { ...CAMPUS.tideStation, distanceMi: 636 },
}
// A beach under hills: its cell averages 640 ft, the beach is at 21 ft.
const EL_CAPITAN: SpotFacts = {
  ...GAVIOTA,
  elevationFt: 21,
  nws: { office: 'LOX', gridX: 95, gridY: 75, elevationFt: 640 },
  tideStation: { ...GAVIOTA.tideStation, distanceMi: 12, direction: 'west' },
  gauge: { ...CAMPUS.gauge, distanceMi: 19 },
}

describe('factsLines', () => {
  test('a spot with its own gauge and a curve', () => {
    expect(factsLines(CAMPUS)).toEqual([
      'Weather: NWS cell LOX 100,71, 3 ft, America/Los_Angeles.',
      'Tide: NOAA 9411340 Santa Barbara, 8.6 mi east. 6-minute curve.',
      'Gauge: its own.',
    ])
  })
  test('a gauge elsewhere, and a cell at 0 ft', () => {
    const lines = factsLines(GAVIOTA)
    expect(lines[0]).toBe(
      'Weather: NWS cell LOX 87,76, 0 ft, America/Los_Angeles.',
    )
    expect(lines.at(-1)).toBe('Gauge: NOAA 9411340 Santa Barbara, 31 mi east.')
  })
  test('a subordinate station says its curve will be interpolated', () => {
    expect(factsLines(VENTURA_WAY)[1]).toBe(
      'Tide: NOAA 9411189 Ventura, 1.4 mi south. Highs and lows only; the curve will be interpolated.',
    )
  })
  test("the spot's own height has a line, after the cell's", () => {
    expect(factsLines(EL_CAPITAN)).toEqual([
      'Weather: NWS cell LOX 95,75, 640 ft, America/Los_Angeles.',
      'Height: 21 ft above sea level, from USGS.',
      'Tide: NOAA 9411399 Gaviota State Park, Pacific Ocean, 12 mi west. 6-minute curve.',
      'Gauge: NOAA 9411340 Santa Barbara, 19 mi east.',
    ])
  })
  // A search can drop the pin in the hills behind the beach it was asked
  // for: El Capitan State Beach's is at 583 ft. The pin can be moved.
  test('a high spot near a station: no station is named, and the pin can go to the shore', () => {
    expect(factsLines(PEAK)).toEqual([
      'Weather: NWS cell LOX 105,74, 3,258 ft, America/Los_Angeles.',
      'Height: 3,997 ft above sea level, from USGS.',
      'Tides are not shown here: the spot is 3,997 ft above sea level. For a tide, put the pin on the shore.',
    ])
  })
  test('far from any tide: the distance, and no station lines', () => {
    expect(factsLines(LAKE)).toEqual([
      'Weather: NWS cell LOX 100,71, 3 ft, America/Los_Angeles.',
      'Tides are not shown here: the nearest station, NOAA 9411340 Santa Barbara, is 636 mi away.',
    ])
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

describe('canSearch', () => {
  test('blank and whitespace cannot search', () => {
    expect(canSearch('', { status: 'idle' })).toBe(false)
    expect(canSearch('   ', { status: 'idle' })).toBe(false)
  })
  test('a word can, unless a search is running', () => {
    expect(canSearch('Gaviota', { status: 'idle' })).toBe(true)
    expect(canSearch('Gaviota', { status: 'searching' })).toBe(false)
  })
})

const HENDRYS: Spot = {
  ...CAMPUS_POINT,
  id: 'spot-abc',
  name: "Hendry's Beach",
  lat: 34.4026,
  lon: -119.7437,
  elevationFt: 12,
}

describe('WORDS for an edit', () => {
  test('the heading and the button', () => {
    expect(WORDS.editHeading).toBe('Edit spot')
    expect(WORDS.edit).toBe('Edit')
  })
})

describe('spotFacts', () => {
  test('is the spot without its id and name', () => {
    const facts = spotFacts(HENDRYS)
    expect(facts).not.toHaveProperty('id')
    expect(facts).not.toHaveProperty('name')
    expect(facts.lat).toBe(34.4026)
    expect(facts.tideStation).toEqual(HENDRYS.tideStation)
  })
})

describe('pinMoved', () => {
  test('the same point, or one that rounds to it, is not a move', () => {
    expect(pinMoved(HENDRYS, { lat: 34.4026, lon: -119.7437 })).toBe(false)
    expect(pinMoved(HENDRYS, { lat: 34.40264, lon: -119.74366 })).toBe(false)
  })
  test('a point that rounds elsewhere is a move', () => {
    expect(pinMoved(HENDRYS, { lat: 34.4027, lon: -119.7437 })).toBe(true)
    expect(pinMoved(HENDRYS, { lat: 34.4026, lon: -119.7436 })).toBe(true)
  })
  // A tap on a world copy of the map is the same place.
  test('the same point on a world copy is not a move', () => {
    expect(pinMoved(HENDRYS, { lat: 34.4026, lon: -119.7437 + 360 })).toBe(
      false,
    )
  })
})

describe('edited', () => {
  const here = { lat: HENDRYS.lat, lon: HENDRYS.lon }
  const there = { lat: 34.41, lon: -119.75 }
  const found = {
    ok: true as const,
    facts: { ...spotFacts(HENDRYS), lat: 34.41, lon: -119.75, elevationFt: 30 },
  }

  test('the same name and pin is nothing', () => {
    expect(edited(HENDRYS, "Hendry's Beach", here, null, 'spot-new')).toEqual({
      kind: 'nothing',
    })
  })
  test('the same name with spaces round it is still nothing', () => {
    expect(
      edited(HENDRYS, "  Hendry's Beach ", here, null, 'spot-new'),
    ).toEqual({ kind: 'nothing' })
  })
  test('a blank name cannot save', () => {
    expect(edited(HENDRYS, '   ', here, null, 'spot-new')).toBeNull()
  })
  test('a new name with the pin in place is a rename under the same id', () => {
    expect(edited(HENDRYS, 'Arroyo Burro', here, null, 'spot-new')).toEqual({
      kind: 'rename',
      spot: { ...HENDRYS, name: 'Arroyo Burro' },
    })
  })
  test('a long name is cut to the limit', () => {
    const edit = edited(HENDRYS, 'x'.repeat(50), here, null, 'spot-new')
    expect(edit?.kind).toBe('rename')
    expect(edit?.kind === 'rename' && edit.spot.name).toHaveLength(NAME_MAX)
  })
  test('a moved pin not yet looked up, or looked up and failed, cannot save', () => {
    expect(
      edited(HENDRYS, "Hendry's Beach", there, null, 'spot-new'),
    ).toBeNull()
    expect(
      edited(
        HENDRYS,
        "Hendry's Beach",
        there,
        { ok: false, reason: 'outside' },
        'spot-new',
      ),
    ).toBeNull()
  })
  test('a moved pin that was looked up is a move, under the new id', () => {
    expect(edited(HENDRYS, "Hendry's Beach", there, found, 'spot-new')).toEqual(
      {
        kind: 'move',
        spot: { ...found.facts, id: 'spot-new', name: "Hendry's Beach" },
      },
    )
  })
  test('a move can rename too', () => {
    const edit = edited(HENDRYS, 'Arroyo Burro', there, found, 'spot-new')
    expect(edit?.kind === 'move' && edit.spot.name).toBe('Arroyo Burro')
  })
  test('a moved pin with a blank name cannot save', () => {
    expect(edited(HENDRYS, '', there, found, 'spot-new')).toBeNull()
  })
  // The pin went away and came back: the saved facts stand, whatever the
  // look-up said in between.
  test('the pin back where it was is not a move', () => {
    expect(edited(HENDRYS, "Hendry's Beach", here, found, 'spot-new')).toEqual({
      kind: 'nothing',
    })
  })
})
