import { describe, expect, it } from 'vitest'
import css from '../styles.css?raw'
import { contrast, luminance, rootTokens } from './contrast.ts'

const tokens = rootTokens(css)

/** WCAG 1.4.3, text. */
const TEXT = 4.5
/** WCAG 1.4.11, graphical objects: lines, dots, arrows and the bands themselves. */
const GRAPHIC = 3

/**
 * What is drawn over each panel background, and how it must stand out. The
 * night band and the day band must stand out from each other (issue 78), and
 * everything drawn over them must be readable on both.
 */
const ON_BANDS: { token: string; as: string; min: number }[] = [
  { token: 'sea', as: 'forecast line, arrows', min: GRAPHIC },
  { token: 'observed', as: 'observed line, arrows', min: GRAPHIC },
  {
    token: 'faint',
    as: 'gust, dew point, feels-like, rain lines',
    min: GRAPHIC,
  },
  { token: 'ember', as: 'sunset line', min: GRAPHIC },
  { token: 'moon', as: 'moonrise line', min: GRAPHIC },
  { token: 'faint', as: 'current-time line', min: GRAPHIC },
  { token: 'faint', as: 'rule labels', min: TEXT },
  { token: 'ink', as: 'marker labels, cursor', min: TEXT },
]

/** What is drawn on the page itself, outside the plots. */
const ON_GROUND: { token: string; as: string; min: number }[] = [
  { token: 'ink', as: 'text', min: TEXT },
  { token: 'muted', as: 'captions, hour labels', min: TEXT },
  { token: 'sea', as: 'buttons, links', min: TEXT },
  { token: 'ember', as: 'sunset key', min: GRAPHIC },
  { token: 'moon', as: 'moon key, flag', min: GRAPHIC },
]

function row(fg: string, bg: string, as: string, min: number) {
  const ratio = contrast(tokens[fg], tokens[bg])
  return { fg, bg, as, min, ratio }
}

const rows = [
  {
    fg: 'day',
    bg: 'night',
    as: 'day against night (bands)',
    min: GRAPHIC,
    ratio: contrast(tokens.day, tokens.night),
  },
  ...ON_BANDS.flatMap((p) => [
    row(p.token, 'day', p.as, p.min),
    row(p.token, 'night', p.as, p.min),
  ]),
  ...ON_GROUND.map((p) => row(p.token, 'ground', p.as, p.min)),
]

describe('contrast', () => {
  it('computes luminance and ratio as WCAG defines them', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1, 5)
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('reads the opaque tokens of :root', () => {
    expect(tokens.ground).toMatch(/^#[0-9a-f]{6}$/)
    for (const name of [
      'day',
      'night',
      'sea',
      'observed',
      'faint',
      'muted',
      'ink',
      'ember',
      'moon',
    ]) {
      expect(
        tokens[name],
        `--${name} is an opaque #rrggbb colour`,
      ).toBeDefined()
    }
  })

  it('prints the table', () => {
    const lines = rows.map(
      (r) =>
        `${r.fg.padEnd(9)} on ${r.bg.padEnd(7)} ${r.ratio.toFixed(2).padStart(6)}  (min ${r.min})  ${r.as}`,
    )
    console.log(
      ['token     on bg      ratio  minimum  drawn as', ...lines].join('\n'),
    )
  })

  it.each(rows)('$fg on $bg is at least $min:1 ($as)', ({ ratio, min }) => {
    expect(ratio).toBeGreaterThanOrEqual(min)
  })
})
