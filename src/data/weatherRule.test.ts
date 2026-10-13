import { describe, expect, test } from 'vitest'
import { parseStations } from './nwsStations.ts'
import {
  STATION_WITHIN_FT,
  STATION_WITHIN_MI,
  chooseStation,
  isStationChoice,
  stationServes,
} from './weatherRule.ts'
import realRaw from './__fixtures__/nws-stations-LOX-100-71.json?raw'

const STATIONS = parseStations(JSON.parse(realRaw))
const CAMPUS_POINT = { lat: 34.4046, lon: -119.844 }
const GAVIOTA = { lat: 34.4716, lon: -120.2284 }
const LA_CUMBRE = { lat: 34.4939, lon: -119.7147 }

describe('stationServes', () => {
  test('within 10 miles and within 500 ft, above or below', () => {
    expect(STATION_WITHIN_MI).toBe(10)
    expect(STATION_WITHIN_FT).toBe(500)
    expect(stationServes(1.5, 10, 3)).toBe(true)
    expect(stationServes(10, 10, 510)).toBe(true)
    expect(stationServes(10, 510, 10)).toBe(true)
    expect(stationServes(10.1, 10, 3)).toBe(false)
    expect(stationServes(1, 10, 511)).toBe(false)
  })
})

describe('chooseStation', () => {
  test('Campus Point, at 3 ft, is served by the airport, 1.5 mi north at 10 ft', () => {
    const { serves } = chooseStation(CAMPUS_POINT, 3, STATIONS)
    expect(serves).toMatchObject({
      id: 'KSBA',
      distanceMi: 1.5,
      direction: 'north',
      elevationFt: 10,
    })
  })

  test('La Cumbre Peak, at 3,997 ft, has none: every station near is far below it, and the nearest is said', () => {
    const { serves, nearest } = chooseStation(LA_CUMBRE, 3997, STATIONS)
    expect(serves).toBeNull()
    expect(nearest).toMatchObject({ id: 'LPOC1', elevationFt: 982 })
    expect(nearest!.distanceMi).toBeCloseTo(5.6, 0)
  })

  test('Gaviota State Park has none within 10 miles, and the nearest is said', () => {
    const { serves, nearest } = chooseStation(GAVIOTA, 0, STATIONS)
    expect(serves).toBeNull()
    expect(nearest!.id).toBe('KIZA')
    expect(nearest!.distanceMi).toBeGreaterThan(10)
  })

  test('the nearest that serves is chosen, not the first in the list', () => {
    // Listed airport first; a closer station at the spot's own height wins.
    const near = {
      id: 'TEST1',
      name: 'Test',
      lat: 34.405,
      lon: -119.844,
      elevationFt: 3,
    }
    const { serves } = chooseStation(CAMPUS_POINT, 3, [STATIONS[0], near])
    expect(serves!.id).toBe('TEST1')
  })

  test('a station 10.3 mi away is saved as 10.3, not rounded to the bar', () => {
    // 10.3 mi due north of Campus Point, at the spot's own height.
    const far = {
      id: 'TEST2',
      name: 'Test',
      lat: CAMPUS_POINT.lat + 10.3 / 69.05,
      lon: CAMPUS_POINT.lon,
      elevationFt: 3,
    }
    const { serves, nearest } = chooseStation(CAMPUS_POINT, 3, [far])
    expect(serves).toBeNull()
    expect(nearest!.distanceMi).toBe(10.3)
  })

  test('with no stations at all, both are null', () => {
    expect(chooseStation(CAMPUS_POINT, 3, [])).toEqual({
      serves: null,
      nearest: null,
    })
  })
})

describe('isStationChoice', () => {
  test('is the shape saved on the device', () => {
    const choice = chooseStation(CAMPUS_POINT, 3, STATIONS)
    expect(isStationChoice(JSON.parse(JSON.stringify(choice)))).toBe(true)
    expect(isStationChoice({ serves: null, nearest: null })).toBe(true)
    expect(isStationChoice({ serves: null })).toBe(false)
    expect(isStationChoice({ serves: { id: 'KSBA' }, nearest: null })).toBe(
      false,
    )
    expect(isStationChoice(null)).toBe(false)
  })
})
