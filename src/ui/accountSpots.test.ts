import { describe, expect, test } from 'vitest'
import { listFromSnapshot } from './accountSpots.ts'
import { CAMPUS_POINT, spotById } from '../spot.ts'

describe('listFromSnapshot', () => {
  test('an empty list is ignored', () => {
    expect(listFromSnapshot({ spots: {}, order: [] })).toBeNull()
    expect(listFromSnapshot(null)).toBeNull()
  })

  test('a list is passed through', () => {
    const gaviota = spotById('gaviota')
    const data = {
      spots: { [CAMPUS_POINT.id]: CAMPUS_POINT, [gaviota.id]: gaviota },
      order: [gaviota.id, CAMPUS_POINT.id],
    }
    expect(listFromSnapshot(data)).toEqual([gaviota, CAMPUS_POINT])
  })
})
