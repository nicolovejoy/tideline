import { expect, test } from 'vitest'

// vite.config.ts sets TZ for the test run. If this fails, the override is not
// reaching the tests and the rest of the suite proves less than it claims.
test('tests run with the device time zone set to Tokyo', () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-540)
})
