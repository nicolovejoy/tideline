import { describe, expect, test } from 'vitest'
import { HELP } from './helpText.ts'

const all = HELP.sections
  .flatMap((section) => [section.heading, ...section.paragraphs])
  .join('\n')

describe('the help', () => {
  test('has a section for each panel, for today, and for the sources', () => {
    expect(HELP.sections.map((s) => s.heading)).toEqual([
      'The panels',
      'Tide',
      'Wind',
      'Temperature',
      'Sky',
      'Today: observed and forecast',
      'Where the numbers come from',
    ])
    for (const section of HELP.sections) {
      expect(section.paragraphs.length).toBeGreaterThan(0)
    }
  })

  test.each([
    'cursor',
    'Day',
    'Week',
    'night',
    'sunset',
    'moonrise',
    'current time',
    'interpolated',
    'gauge',
    'arrow',
    'gust',
    'dew point',
    'feels',
    'humidity',
    'cloud',
    'rain',
    'station',
    'forecast',
    'horizon',
  ])('names %s, which the panels draw', (word) => {
    expect(all.toLowerCase()).toContain(word.toLowerCase())
  })

  test('says how to pinch the panels', () => {
    const panels = HELP.sections.find((s) => s.heading === 'The panels')
    expect(panels?.paragraphs.join('\n')).toContain('Pinch')
  })

  test('carries the rules as the app has them', () => {
    expect(all).toContain('10 miles')
    expect(all).toContain('500 feet')
    expect(all).toContain('25 miles')
    expect(all).toContain('300 feet')
    expect(all).toContain('5 mph or more')
    expect(all).toContain('2°F or more')
  })
})
