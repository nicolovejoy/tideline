import { describe, expect, test } from 'vitest'
import {
  CAMPUS_POINT,
  SPOTS,
  hasOwnCurve,
  allSpots,
  hasOwnGauge,
  hasTides,
  isSaved,
  spotById,
} from './spot.ts'
import gaviotaCell from './data/__fixtures__/nws-gridpoint-LOX-87-76.json'
import laCumbreCell from './data/__fixtures__/nws-gridpoint-LOX-105-74.json'
import campusCell from './data/__fixtures__/nws-gridpoint-LOX-100-71.json'

const FT_PER_M = 3.28084

describe('the spots', () => {
  test('are three, with Campus Point first and unchanged', () => {
    expect(SPOTS.map((spot) => spot.id)).toEqual([
      'campus-point',
      'gaviota',
      'la-cumbre-peak',
    ])
    expect(SPOTS[0]).toBe(CAMPUS_POINT)
    expect(CAMPUS_POINT.tideStation.id).toBe('9411340')
  })

  test('each has its own forecast cell', () => {
    const cells = SPOTS.map((spot) => `${spot.nws.gridX},${spot.nws.gridY}`)
    expect(new Set(cells).size).toBe(3)
  })

  test("each cell's elevation is what NWS gives for it, in feet", () => {
    const fixtures = {
      'campus-point': campusCell,
      gaviota: gaviotaCell,
      'la-cumbre-peak': laCumbreCell,
    }
    for (const spot of SPOTS) {
      const metres =
        fixtures[spot.id as keyof typeof fixtures].properties.elevation.value
      expect(spot.nws.elevationFt).toBe(Math.round(metres * FT_PER_M))
    }
  })

  test("Gaviota's station has no gauge, so its gauge is Santa Barbara", () => {
    const gaviota = spotById('gaviota')
    expect(gaviota.tideStation.id).toBe('9411399')
    expect(gaviota.gauge.id).toBe('9411340')
    expect(hasOwnGauge(gaviota)).toBe(false)
    expect(hasOwnGauge(CAMPUS_POINT)).toBe(true)
  })

  test('only La Cumbre Peak carries a height of its own', () => {
    expect(SPOTS.map((spot) => spot.elevationFt)).toEqual([null, null, 3997])
  })

  test('every shipped station is harmonic, so each spot has its own curve', () => {
    // Verified against NOAA's station metadata on 2026-10-10: 9411340 and
    // 9411399 are type R. Subordinate stations arrive with #4.
    for (const spot of SPOTS) {
      expect(spot.tideStation.type).toBe('harmonic')
      expect(spot.gauge.type).toBe('harmonic')
      expect(hasOwnCurve(spot)).toBe(true)
    }
  })

  test('a spot at a subordinate station has no curve of its own', () => {
    const gaviota = spotById('gaviota')
    const ventura = {
      ...gaviota,
      tideStation: { ...gaviota.tideStation, type: 'subordinate' as const },
    }
    expect(hasOwnCurve(ventura)).toBe(false)
  })

  test('an id that is not a spot means Campus Point', () => {
    expect(spotById('nowhere')).toBe(CAMPUS_POINT)
    expect(spotById(null)).toBe(CAMPUS_POINT)
    expect(spotById('la-cumbre-peak').name).toBe('La Cumbre Peak')
  })
})

describe('whether a spot has a tide', () => {
  const gaviota = spotById('gaviota')
  // A beach under hills: 21 ft by USGS, in a cell that averages 640 ft.
  const elCapitan = {
    ...gaviota,
    id: 'spot-elcap',
    name: 'El Capitan State Beach',
    elevationFt: 21,
    nws: { office: 'LOX', gridX: 95, gridY: 75, elevationFt: 640 },
    tideStation: { ...gaviota.tideStation, distanceMi: 12, direction: 'west' },
  }

  test('La Cumbre Peak has none; the other two have', () => {
    expect(SPOTS.map(hasTides)).toEqual([true, true, false])
  })

  test("goes by the spot's own height, not its cell's: a beach under hills has one", () => {
    expect(hasTides(elCapitan)).toBe(true)
  })

  test('and a peak in a low cell has none', () => {
    expect(hasTides({ ...CAMPUS_POINT, elevationFt: 2000 })).toBe(false)
  })

  test("goes by the cell's average where the spot's own height is not known", () => {
    expect(hasTides({ ...elCapitan, elevationFt: null })).toBe(false)
    expect(hasTides(CAMPUS_POINT)).toBe(true)
  })

  test('a far station means none, however low the spot', () => {
    const lake = {
      ...CAMPUS_POINT,
      elevationFt: 580,
      tideStation: { ...CAMPUS_POINT.tideStation, distanceMi: 636 },
    }
    expect(hasTides(lake)).toBe(false)
    expect(hasTides({ ...lake, elevationFt: 0 })).toBe(false)
  })

  // Until 2026-10-10 a tick on the add screen could show the tide anywhere,
  // and was saved with the spot. It is read past now.
  test('is not a choice: a peak saved with its tide ticked on has none', () => {
    const ticked = {
      ...spotById('la-cumbre-peak'),
      id: 'spot-peak',
      elevationFt: null,
      tidesShown: true,
    }
    expect(hasTides(ticked)).toBe(false)
  })
})

describe('saved spots beside the hard-coded ones', () => {
  const saved = { ...CAMPUS_POINT, id: 'spot-abc', name: 'Leadbetter Beach' }
  test('allSpots lists the three first, then the saved', () => {
    expect(allSpots([saved]).map((spot) => spot.id)).toEqual([
      'campus-point',
      'gaviota',
      'la-cumbre-peak',
      'spot-abc',
    ])
    expect(allSpots([])).toEqual(SPOTS)
  })
  test('spotById finds a saved spot in the list it is given', () => {
    expect(spotById('spot-abc', allSpots([saved]))).toBe(saved)
    expect(spotById('spot-abc')).toBe(CAMPUS_POINT)
  })
  test('only a saved spot can be removed', () => {
    expect(isSaved(saved)).toBe(true)
    expect(SPOTS.map(isSaved)).toEqual([false, false, false])
  })
})
