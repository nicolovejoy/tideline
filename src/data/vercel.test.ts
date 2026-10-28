import { describe, expect, it } from 'vitest'
import raw from '../../vercel.json?raw'

type Rewrite = { source: string; destination: string }

describe('vercel.json', () => {
  const json = JSON.parse(raw) as {
    rewrites: Rewrite[]
  }

  it('serves the auth handoff from our own host', () => {
    const auth = json.rewrites.find((r) => r.source === '/__/auth/:path*')
    expect(auth).toBeDefined()
    expect(auth!.destination).toMatch(
      /^https:\/\/[a-z0-9-]+\.firebaseapp\.com\/__\/auth\/:path\*$/,
    )
  })

  it('puts the auth rewrite ahead of any catch-all', () => {
    const i = json.rewrites.findIndex((r) => r.source === '/__/auth/:path*')
    const catchAll = json.rewrites.findIndex((r) => r.source === '/:path*')
    expect(catchAll === -1 || i < catchAll).toBe(true)
  })
})
