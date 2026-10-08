// Sunset and moonrise from the US Naval Observatory for Campus Point
// (latitude 34.4046, longitude -119.8440), recorded on 2026-10-08 from
// https://aa.usno.navy.mil/api/rstt/oneday. Local clock times, rounded to the
// minute by the Observatory. utcOffset is hours from UTC for those times.

export interface UsnoRow {
  date: string
  utcOffset: number
  sunset: string
  moonrise: string | null
}

export const USNO_CAMPUS_POINT: UsnoRow[] = [
  { date: '2026-10-08', utcOffset: -7, sunset: '18:34', moonrise: '05:00' },
  { date: '2026-10-09', utcOffset: -7, sunset: '18:32', moonrise: '06:03' },
  { date: '2026-10-10', utcOffset: -7, sunset: '18:31', moonrise: '07:05' },
  { date: '2026-10-11', utcOffset: -7, sunset: '18:30', moonrise: '08:08' },
  { date: '2026-10-12', utcOffset: -7, sunset: '18:28', moonrise: '09:10' },
  { date: '2026-10-13', utcOffset: -7, sunset: '18:27', moonrise: '10:12' },
  { date: '2026-10-14', utcOffset: -7, sunset: '18:26', moonrise: '11:12' },
  { date: '2026-10-15', utcOffset: -7, sunset: '18:25', moonrise: '12:08' },
  { date: '2026-10-16', utcOffset: -7, sunset: '18:23', moonrise: '12:58' },
  { date: '2026-10-17', utcOffset: -7, sunset: '18:22', moonrise: '13:42' },
  { date: '2026-10-18', utcOffset: -7, sunset: '18:21', moonrise: '14:20' },
  { date: '2026-10-19', utcOffset: -7, sunset: '18:20', moonrise: '14:54' },
  { date: '2026-10-20', utcOffset: -7, sunset: '18:19', moonrise: '15:23' },
  { date: '2026-10-21', utcOffset: -7, sunset: '18:17', moonrise: '15:51' },
  { date: '2026-10-22', utcOffset: -7, sunset: '18:16', moonrise: '16:17' },
  { date: '2026-10-23', utcOffset: -7, sunset: '18:15', moonrise: '16:44' },
  { date: '2026-10-24', utcOffset: -7, sunset: '18:14', moonrise: '17:13' },
  { date: '2026-10-25', utcOffset: -7, sunset: '18:13', moonrise: '17:45' },
  { date: '2026-10-26', utcOffset: -7, sunset: '18:12', moonrise: '18:23' },
  { date: '2026-10-27', utcOffset: -7, sunset: '18:11', moonrise: '19:09' },
  { date: '2026-10-28', utcOffset: -7, sunset: '18:10', moonrise: '20:04' },
  { date: '2026-10-29', utcOffset: -7, sunset: '18:09', moonrise: '21:08' },
  { date: '2026-10-30', utcOffset: -7, sunset: '18:08', moonrise: '22:18' },
  { date: '2026-10-31', utcOffset: -7, sunset: '18:07', moonrise: '23:30' },
  // The clocks go back at 2 AM on 1 November, so that day is 25 hours long
  // and these times are Pacific standard time.
  { date: '2026-11-01', utcOffset: -8, sunset: '17:06', moonrise: '23:40' },
  // No moonrise on this local day.
  { date: '2026-11-02', utcOffset: -8, sunset: '17:05', moonrise: null },
  { date: '2026-11-03', utcOffset: -8, sunset: '17:04', moonrise: '00:47' },
]
