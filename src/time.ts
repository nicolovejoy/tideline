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

/** The hour of the day, 0 to 23, in a zone at instant t. */
export function localHour(t: number, timeZone: string): number {
  return wallClock(t, timeZone).hour
}

/**
 * The instants between start and end, inclusive, that fall on a local hour
 * divisible by `every`. Stepping hour by hour keeps this right on days when
 * the clocks change.
 */
export function hourMarks(
  start: number,
  end: number,
  timeZone: string,
  every: number,
): { t: number; hour: number }[] {
  const marks: { t: number; hour: number }[] = []
  for (let t = start; t <= end; t += 3_600_000) {
    const hour = localHour(t, timeZone)
    if (hour % every === 0) marks.push({ t, hour })
  }
  return marks
}

/** Looks up one named part of a formatted date, or '' if it is absent. */
function partReader(
  format: Intl.DateTimeFormat,
  t: number,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = format.formatToParts(t)
  return (type) => parts.find((p) => p.type === type)?.value ?? ''
}

/** A 12-hour clock time in a zone, such as '6:33 PM'. */
export function formatTime(t: number, timeZone: string): string {
  const part = partReader(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    t,
  )
  // Assembled from parts, because browsers disagree on which kind of space
  // goes before AM/PM, and some use one that is invisible in source code.
  return `${part('hour')}:${part('minute')} ${part('dayPeriod')}`
}

/** A calendar date for display, such as 'Thu Oct 8'. No zone is involved. */
export function formatDay(date: string): string {
  const [year, month, day] = parseDate(date)
  const part = partReader(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    Date.UTC(year, month - 1, day, 12),
  )
  return `${part('weekday')} ${part('month')} ${part('day')}`
}
