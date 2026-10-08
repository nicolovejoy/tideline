export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  /** IANA zone. Every displayed time and calendar day uses it. */
  timeZone: string
  /** The 2.5 km NWS forecast cell containing the spot. */
  nws: { office: string; gridX: number; gridY: number }
  tideStation: {
    id: string
    name: string
    distanceMi: number
    direction: string
  }
}

export const CAMPUS_POINT: Spot = {
  id: 'campus-point',
  name: 'Campus Point',
  lat: 34.4046,
  lon: -119.844,
  timeZone: 'America/Los_Angeles',
  nws: { office: 'LOX', gridX: 100, gridY: 71 },
  tideStation: {
    id: '9411340',
    name: 'Santa Barbara',
    distanceMi: 8.6,
    direction: 'east',
  },
}
