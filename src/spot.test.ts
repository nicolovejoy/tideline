import { describe, expect, test } from 'vitest'
import { CAMPUS_POINT, SPOTS, hasOwnGauge, spotById } from './spot.ts'
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

  test('La Cumbre Peak hides its tide by default; the others show it', () => {
    expect(SPOTS.map((spot) => spot.tidesShown)).toEqual([true, true, false])
  })

  test('only La Cumbre Peak has an elevation worth saying', () => {
    expect(SPOTS.map((spot) => spot.elevationFt)).toEqual([null, null, 3997])
  })

  test('an id that is not a spot means Campus Point', () => {
    expect(spotById('nowhere')).toBe(CAMPUS_POINT)
    expect(spotById(null)).toBe(CAMPUS_POINT)
    expect(spotById('la-cumbre-peak').name).toBe('La Cumbre Peak')
  })
})
