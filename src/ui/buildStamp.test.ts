import { describe, expect, test } from 'vitest'
import { buildStamp } from './buildStamp.ts'

const LA = 'America/Los_Angeles'
// 2:31 PM Pacific on 10 October.
const BUILT_AT = '2026-10-10T21:31:07.412Z'
const COMMIT = 'bd0e55b985662043b833b87ae4e6fd35a103f93c'

describe('buildStamp', () => {
  test('the day and the 12-hour time the build was made, in the zone given', () => {
    const stamp = buildStamp({ builtAt: BUILT_AT, commit: '' }, LA)
    expect(stamp?.words).toBe('Build Oct 10, 2:31 PM')
    expect(
      buildStamp({ builtAt: BUILT_AT, commit: '' }, 'America/New_York')?.words,
    ).toBe('Build Oct 10, 5:31 PM')
  })
  test("the day is the zone's, not UTC's", () => {
    // 6:31 AM on the 11th in Tokyo, still the 10th in UTC.
    const stamp = buildStamp({ builtAt: BUILT_AT, commit: '' }, 'Asia/Tokyo')
    expect(stamp?.words).toBe('Build Oct 11, 6:31 AM')
  })
  test('with a commit, its first seven characters and its page on GitHub', () => {
    const stamp = buildStamp({ builtAt: BUILT_AT, commit: COMMIT }, LA)
    expect(stamp?.commit).toEqual({
      short: 'bd0e55b',
      url: 'https://github.com/nicolovejoy/tideline/commit/bd0e55b985662043b833b87ae4e6fd35a103f93c',
      label: 'Commit bd0e55b on GitHub',
    })
  })
  test('a build that knows no commit has none', () => {
    expect(buildStamp({ builtAt: BUILT_AT, commit: '' }, LA)?.commit).toBeNull()
  })
  test('something that is not a commit hash is left out', () => {
    for (const commit of ['undefined', 'main', 'bd0e', '<script>']) {
      expect(buildStamp({ builtAt: BUILT_AT, commit }, LA)?.commit).toBeNull()
    }
  })
  test('a time that is not one gives no stamp at all', () => {
    expect(buildStamp({ builtAt: '', commit: COMMIT }, LA)).toBeNull()
    expect(buildStamp({ builtAt: 'yesterday', commit: COMMIT }, LA)).toBeNull()
  })
})
