// The only module that knows about time zones. Every other module works in
// UTC instants (epoch milliseconds) and asks this one for anything local.

const clockFormats = new Map<string, Intl.DateTimeFormat>()

function clockFormat(timeZone: string): Intl.DateTimeFormat {
  let format = clockFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    clockFormats.set(timeZone, format)
  }
  return format
}

/** The wall-clock reading in a zone at instant t, as numbers. */
function wallClock(t: number, timeZone: string): Record<string, number> {
  const clock: Record<string, number> = {}
  for (const { type, value } of clockFormat(timeZone).formatToParts(t)) {
    if (type !== 'literal') clock[type] = Number(value)
  }
  return clock
}

/** How far a zone is from UTC at instant t, in ms. Negative west of Greenwich. */
function zoneOffset(t: number, timeZone: string): number {
  const c = wallClock(t, timeZone)
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second)
  return asUtc - Math.floor(t / 1000) * 1000
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseDate(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number)
  return [year, month, day]
}

/** The calendar date in a zone at instant t, as 'YYYY-MM-DD'. */
export function localDate(t: number, timeZone: string): string {
  const c = wallClock(t, timeZone)
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`
}

/** The instant a calendar date begins (local midnight) in a zone. */
export function localDayStart(date: string, timeZone: string): number {
  const [year, month, day] = parseDate(date)
  const utcMidnight = Date.UTC(year, month - 1, day)
  // Two passes: on a clock-change day the offset at the first guess can differ
  // from the offset at the answer.
  const guess = utcMidnight - zoneOffset(utcMidnight, timeZone)
  return utcMidnight - zoneOffset(guess, timeZone)
}

/** Calendar arithmetic on a 'YYYY-MM-DD' date. No zone is involved. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = parseDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
  ].join('-')
}

/** A 12-hour clock time in a zone, such as '6:33 PM'. */
export function formatTime(t: number, timeZone: string): string {
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(t)
  // Some browsers put a narrow no-break space before AM/PM. Use a plain one.
  return text.replace(/ /g, ' ')
}
