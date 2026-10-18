/**
 * WCAG 2 contrast, for checking the palette: relative luminance and the
 * contrast ratio between two opaque sRGB colours written as `#rrggbb`.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

function channel(byte: number): number {
  const c = byte / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** The relative luminance of an opaque `#rrggbb` colour, 0 for black and 1 for white. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`not an opaque #rrggbb colour: ${hex}`)
  const n = parseInt(m[1], 16)
  const r = channel(n >> 16)
  const g = channel((n >> 8) & 0xff)
  const b = channel(n & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The contrast ratio between two opaque colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** The `--name: #rrggbb` tokens of a stylesheet's `:root` block, by name. */
export function rootTokens(css: string): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(css)
  if (!root) throw new Error('no :root block')
  const tokens: Record<string, string> = {}
  for (const m of root[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens[m[1]] = m[2].toLowerCase()
  }
  return tokens
}
