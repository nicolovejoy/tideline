import { describe, expect, test } from 'vitest'
import { NAME_MAX } from './addSpotView.ts'
import {
  SHARE,
  handOver,
  lookupLine,
  openedLink,
  parseShareLink,
  shareUrl,
  sharedSpotId,
  spotAt,
} from './shareView.ts'
import type { ShareDevice } from './shareView.ts'
import { newSpotId } from '../data/savedSpots.ts'
import { CAMPUS_POINT, SPOTS, allSpots, isSaved, spotById } from '../spot.ts'
import type { Spot } from '../spot.ts'

const SITE = 'https://tideline.ibuild4you.com'
const GAVIOTA = spotById('gaviota')

const HENDRYS: Spot = {
  ...CAMPUS_POINT,
  id: 'spot-abc',
  name: "Hendry's Beach",
  lat: 34.4026,
  lon: -119.7437,
}

describe('shareUrl', () => {
  test("the site's address, the name, then the place", () => {
    expect(shareUrl(HENDRYS, SITE)).toBe(
      'https://tideline.ibuild4you.com/?name=Hendry%27s+Beach&at=34.4026%2C-119.7437',
    )
  })
  test('on whatever address the page is served from', () => {
    expect(shareUrl(CAMPUS_POINT, 'http://localhost:5173')).toBe(
      'http://localhost:5173/?name=Campus+Point&at=34.4046%2C-119.844',
    )
  })
  test('the place to four decimals, however many the spot carries', () => {
    const spot = { ...HENDRYS, lat: 34.40261234, lon: -119.74372 }
    expect(shareUrl(spot, SITE)).toBe(shareUrl(HENDRYS, SITE))
  })
  // A name can end in a bracket or a full stop, which a message app may
  // leave out of the link. A digit it keeps.
  test('ends in a digit, whatever the name ends in', () => {
    for (const name of ['Rincon (the cove)', 'Mesa Ln.', 'Why?', 'Rock!']) {
      expect(shareUrl({ ...HENDRYS, name }, SITE)).toMatch(/\d$/)
    }
  })
})

describe('parseShareLink', () => {
  test('the link shareUrl makes', () => {
    expect(
      parseShareLink('?name=Hendry%27s+Beach&at=34.4026%2C-119.7437'),
    ).toEqual({ name: "Hendry's Beach", lat: 34.4026, lon: -119.7437 })
  })
  test('with or without the question mark', () => {
    expect(parseShareLink('name=Campus+Point&at=34.4046%2C-119.844')).toEqual({
      name: 'Campus Point',
      lat: 34.4046,
      lon: -119.844,
    })
  })
  test('a comma typed as a comma, whole numbers, and the place first', () => {
    expect(parseShareLink('?at=34,-120&name=Somewhere')).toEqual({
      name: 'Somewhere',
      lat: 34,
      lon: -120,
    })
  })
  test('a name comes back as it went, whatever is in it', () => {
    for (const name of [
      "Hendry's Beach",
      'Sands & Ellwood',
      'Low tide +1 ft',
      'Rincon (the cove) [left]',
      'Playa Año Nuevo, 北の浜',
      '100% #1 spot? yes/no = maybe',
    ]) {
      const link = shareUrl({ ...HENDRYS, name }, SITE)
      expect(parseShareLink(new URL(link).search)).toEqual({
        name,
        lat: 34.4026,
        lon: -119.7437,
      })
    }
  })

  test('no place, no link', () => {
    for (const search of ['', '?', '?name=Campus+Point', '?at', '?at=']) {
      expect(parseShareLink(search)).toBeNull()
    }
  })
  test('a place is two plain numbers with one comma between', () => {
    for (const at of [
      '34.4026',
      '34.4026,-119.7437,12',
      '34,4026,-119,7437',
      'here,there',
      'north,-119.7437',
      '34.4026,-119.7437ft',
      '3e1,-1.2e2',
      '0x22,-0x77',
      'Infinity,0',
      'NaN,NaN',
      ',',
      '34.4026,',
      ',-119.7437',
      ' , ',
      '34.4026, -119.7437',
      ' 34.4026,-119.7437',
      '34.4026;-119.7437',
      '+34.4026,-119.7437',
      '34.4026,--119.7437',
      '.5,1',
      '5.,1',
    ]) {
      expect(parseShareLink(`?at=${encodeURIComponent(at)}`), at).toBeNull()
    }
  })
  test('a place on Earth: latitude to 90, longitude to 180', () => {
    for (const at of [
      '90.0001,0',
      '-91,0',
      '0,180.0001',
      '0,-181',
      '34.4026,240.2563',
      '1000,1000',
    ]) {
      expect(parseShareLink(`?at=${at}`), at).toBeNull()
    }
    expect(parseShareLink('?at=90,-180')).toMatchObject({ lat: 90, lon: -180 })
    expect(parseShareLink('?at=-90,179.9999')).toMatchObject({
      lat: -90,
      lon: 179.9999,
    })
  })
  test('more than four decimals are rounded to four', () => {
    expect(parseShareLink('?at=34.40261234,-119.74372')).toMatchObject({
      lat: 34.4026,
      lon: -119.7437,
    })
  })
  test('nothing comes back as minus zero', () => {
    const point = parseShareLink('?at=-0,-0.00001')
    expect(Object.is(point?.lat, 0)).toBe(true)
    expect(Object.is(point?.lon, 0)).toBe(true)
  })
  // A spot is added with 180 read as -180, the same meridian. Read the same
  // way here, the spot saved from a link is the one that link finds.
  test('longitude 180 is -180, as it is when a spot is added', () => {
    expect(parseShareLink('?at=52,180')?.lon).toBe(-180)
    expect(parseShareLink('?at=52,179.99996')?.lon).toBe(-180)
  })

  test('a place with no name is a spot called Shared spot', () => {
    for (const search of [
      '?at=34.4026,-119.7437',
      '?name=&at=34.4026,-119.7437',
      '?name=+++&at=34.4026,-119.7437',
      '?name=%20%09&at=34.4026,-119.7437',
    ]) {
      expect(parseShareLink(search)).toEqual({
        name: 'Shared spot',
        lat: 34.4026,
        lon: -119.7437,
      })
    }
  })
  test("the name is trimmed and cut to the add screen's limit", () => {
    expect(
      parseShareLink('?name=++Leadbetter+Beach+&at=34.4027,-119.7073')?.name,
    ).toBe('Leadbetter Beach')
    const link = shareUrl({ ...HENDRYS, name: 'x'.repeat(60) }, SITE)
    expect(parseShareLink(new URL(link).search)).toEqual({
      name: 'x'.repeat(NAME_MAX),
      lat: 34.4026,
      lon: -119.7437,
    })
  })
  test('a mangled link is no link, and does not throw', () => {
    expect(parseShareLink('?name=%E0%A4%A&at=%')).toBeNull()
    expect(parseShareLink('?name=%E0%A4%A&at=34.4026,-119.7437')?.lat).toBe(
      34.4026,
    )
  })
})

describe('spotAt', () => {
  const spots = allSpots([HENDRYS])

  test('the spot at that point, built in or saved', () => {
    expect(spotAt(spots, { lat: 34.4046, lon: -119.844 })).toBe(CAMPUS_POINT)
    expect(spotAt(spots, { lat: 34.4716, lon: -120.2284 })).toBe(GAVIOTA)
    expect(spotAt(spots, { lat: 34.4026, lon: -119.7437 })).toBe(HENDRYS)
  })
  test('to four places, on either side', () => {
    expect(spotAt(spots, { lat: 34.40461, lon: -119.84398 })).toBe(CAMPUS_POINT)
    const fine = { ...HENDRYS, lat: 34.40263, lon: -119.74372 }
    expect(spotAt([fine], { lat: 34.4026, lon: -119.7437 })).toBe(fine)
  })
  test('one step away in the fourth place is another point', () => {
    expect(spotAt(spots, { lat: 34.4047, lon: -119.844 })).toBeUndefined()
    expect(spotAt(spots, { lat: 34.4045, lon: -119.844 })).toBeUndefined()
    expect(spotAt(spots, { lat: 34.4046, lon: -119.8441 })).toBeUndefined()
    expect(spotAt(spots, { lat: 34.4046, lon: -119.8439 })).toBeUndefined()
  })
  test("one spot's latitude and another's longitude is neither", () => {
    expect(spotAt(spots, { lat: 34.4046, lon: -120.2284 })).toBeUndefined()
  })
  test('no spots, no spot', () => {
    expect(spotAt([], { lat: 34.4046, lon: -119.844 })).toBeUndefined()
  })
})

describe('openedLink', () => {
  test('an address with no link in it', () => {
    expect(openedLink('', SPOTS)).toEqual({ kind: 'none' })
    expect(openedLink('?at=nowhere', SPOTS)).toEqual({ kind: 'none' })
    expect(openedLink('?name=Campus+Point', SPOTS)).toEqual({ kind: 'none' })
  })
  test("a built-in spot's place under another name is that spot", () => {
    const opened = openedLink('?name=The+Point&at=34.4046%2C-119.844', SPOTS)
    expect(opened).toEqual({ kind: 'have', spot: CAMPUS_POINT })
    expect(opened.kind === 'have' && opened.spot).toBe(CAMPUS_POINT)
  })
  test('a saved spot is found by its own link', () => {
    const search = new URL(shareUrl(HENDRYS, SITE)).search
    const opened = openedLink(search, allSpots([HENDRYS]))
    expect(opened.kind === 'have' && opened.spot).toBe(HENDRYS)
  })
  test('a place the device has no spot at, with the name it came with', () => {
    const search = new URL(shareUrl(HENDRYS, SITE)).search
    expect(openedLink(search, SPOTS)).toEqual({
      kind: 'new',
      point: { name: "Hendry's Beach", lat: 34.4026, lon: -119.7437 },
    })
  })
})

describe('sharedSpotId', () => {
  test('made from the place', () => {
    expect(sharedSpotId({ lat: 34.4026, lon: -119.7437 })).toBe(
      'shared-34.4026,-119.7437',
    )
  })
  // A reload before saving finds what was fetched the first time.
  test('the same for the same place, to four places', () => {
    expect(sharedSpotId({ lat: 34.40261234, lon: -119.74372 })).toBe(
      sharedSpotId({ lat: 34.4026, lon: -119.7437 }),
    )
  })
  test('another for another place', () => {
    const ids = [
      { lat: 34.4026, lon: -119.7437 },
      { lat: 34.4027, lon: -119.7437 },
      { lat: 34.4026, lon: -119.7438 },
      { lat: 34.4026, lon: 119.7437 },
      { lat: -34.4026, lon: -119.7437 },
      { lat: 10, lon: 20 },
      { lat: 20, lon: 10 },
      { lat: 1.2, lon: 3 },
      { lat: 1, lon: 2.3 },
    ].map(sharedSpotId)
    expect(new Set(ids).size).toBe(ids.length)
  })
  test("never a built-in spot's id, nor one the add screen makes", () => {
    const id = sharedSpotId({ lat: 34.4046, lon: -119.844 })
    expect(SPOTS.map((spot) => spot.id)).not.toContain(id)
    expect(id.startsWith('spot-')).toBe(false)
    expect(newSpotId().startsWith('shared-')).toBe(false)
    // So a spot saved from a link can be removed, as any saved spot can.
    expect(isSaved({ ...CAMPUS_POINT, id })).toBe(true)
  })
})

describe('SHARE', () => {
  test('the share line', () => {
    expect(SHARE.share).toBe('Share this spot')
    expect(SHARE.copied).toBe('Link copied.')
    expect(SHARE.copyThis).toBe('Copy this link:')
  })
  test('a spot opened from a link', () => {
    expect(SHARE.notice).toBe('Shared with you. Not saved on this device.')
    expect(SHARE.save).toBe('Save')
    expect(SHARE.close).toBe('Close')
    expect(SHARE.name).toBe('Shared spot')
  })
  test('while it is looked up, in the words of the add screen', () => {
    expect(SHARE.looking).toBe(
      'Looking up the forecast and the nearest stations…',
    )
    expect(SHARE.tryAgain).toBe('Try again')
  })
})

describe('lookupLine', () => {
  test('looking, until the point has its answer', () => {
    expect(lookupLine(false, null)).toEqual({
      words: 'Looking up the forecast and the nearest stations…',
      tryAgain: false,
    })
  })
  test('outside the US: there is nothing to try again for', () => {
    expect(lookupLine(false, { ok: false, reason: 'outside' })).toEqual({
      words: 'NWS has no forecast here. Tideline covers the US.',
      tryAgain: false,
    })
  })
  test('NWS not answering can be tried again', () => {
    expect(lookupLine(false, { ok: false, reason: 'unreachable' })).toEqual({
      words:
        "Couldn't reach the National Weather Service. Try again in a minute.",
      tryAgain: true,
    })
  })
  test('a station list that did not arrive reads the same, whatever else is known', () => {
    const unreachable = lookupLine(false, { ok: false, reason: 'unreachable' })
    expect(lookupLine(true, null)).toEqual(unreachable)
    expect(lookupLine(true, { ok: false, reason: 'outside' })).toEqual(
      unreachable,
    )
  })
  test('nothing, once the spot is found', () => {
    expect(lookupLine(false, { ok: true, facts: CAMPUS_POINT })).toBeNull()
  })
})

const LINK = shareUrl(CAMPUS_POINT, SITE)

/** A browser with a share sheet, a clipboard, both or neither. */
function fakeDevice(has: {
  share?: () => Promise<void>
  write?: () => Promise<void>
}) {
  const shared: unknown[] = []
  const copied: string[] = []
  const device: ShareDevice = {}
  const { share, write } = has
  if (share) {
    device.share = (data) => {
      shared.push(data)
      return share()
    }
  }
  if (write) {
    device.clipboard = {
      writeText: (text) => {
        copied.push(text)
        return write()
      },
    }
  }
  return { device, shared, copied }
}

const works = async () => {}
const closed = () =>
  Promise.reject(new DOMException('Share canceled', 'AbortError'))
const refused = () =>
  Promise.reject(new DOMException('Not allowed', 'NotAllowedError'))

describe('handOver', () => {
  test('a share sheet gets the name and the link, and nothing is copied', async () => {
    const { device, shared, copied } = fakeDevice({
      share: works,
      write: works,
    })
    expect(await handOver(device, 'Campus Point', LINK)).toBe('sheet')
    expect(shared).toEqual([{ title: 'Campus Point', url: LINK }])
    expect(copied).toEqual([])
  })
  test('a sheet closed without sharing is not a failure', async () => {
    const { device, copied } = fakeDevice({ share: closed, write: works })
    expect(await handOver(device, 'Campus Point', LINK)).toBe('sheet')
    expect(copied).toEqual([])
  })
  test('a sheet that fails any other way: the link is copied', async () => {
    for (const share of [refused, () => Promise.reject(new TypeError())]) {
      const { device, copied } = fakeDevice({ share, write: works })
      expect(await handOver(device, 'Campus Point', LINK)).toBe('copied')
      expect(copied).toEqual([LINK])
    }
  })
  test('no sheet: the link is copied', async () => {
    const { device, copied } = fakeDevice({ write: works })
    expect(await handOver(device, 'Campus Point', LINK)).toBe('copied')
    expect(copied).toEqual([LINK])
  })
  test('a clipboard that refuses: the link is to be shown', async () => {
    const { device } = fakeDevice({ write: refused })
    expect(await handOver(device, 'Campus Point', LINK)).toBe('show')
    const both = fakeDevice({ share: refused, write: refused })
    expect(await handOver(both.device, 'Campus Point', LINK)).toBe('show')
  })
  test('neither a sheet nor a clipboard: the link is to be shown', async () => {
    expect(await handOver({}, 'Campus Point', LINK)).toBe('show')
    const { device } = fakeDevice({ share: refused })
    expect(await handOver(device, 'Campus Point', LINK)).toBe('show')
  })
  test('something that throws where it should answer is a failure too', async () => {
    const thrower = () => {
      throw new Error('not today')
    }
    const { device, copied } = fakeDevice({ share: thrower, write: works })
    expect(await handOver(device, 'Campus Point', LINK)).toBe('copied')
    expect(copied).toEqual([LINK])
    const none = fakeDevice({ write: thrower })
    expect(await handOver(none.device, 'Campus Point', LINK)).toBe('show')
  })
  // A browser's share and writeText answer "Illegal invocation" when they
  // are called apart from the objects they belong to.
  test('each is asked as a part of the device it belongs to', async () => {
    const seen: unknown[] = []
    const device: ShareDevice = {
      share(this: unknown) {
        seen.push(this)
        return refused()
      },
      clipboard: {
        writeText(this: unknown) {
          seen.push(this)
          return works()
        },
      },
    }
    await handOver(device, 'Campus Point', LINK)
    expect(seen[0]).toBe(device)
    expect(seen[1]).toBe(device.clipboard)
  })
})
