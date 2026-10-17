// The words behind the "?" beside the panels: what each panel draws and
// why, with the rules the app uses, for the sheet that opens over the
// panels (issue 75). Plain data, no arithmetic.

import { STATION_WITHIN_MI } from '../data/weatherRule.ts'

export interface HelpSection {
  heading: string
  paragraphs: string[]
}

export interface HelpText {
  title: string
  close: string
  /** The "?" button's name for a screen reader. */
  button: string
  sections: HelpSection[]
}

export const HELP: HelpText = {
  title: 'What the panels show',
  close: 'Close',
  button: 'What the panels show',
  sections: [
    {
      heading: 'The panels',
      paragraphs: [
        'Four panels share one time axis: the tide, the wind, the temperature and the sky, for the same place and the same hours. Touch or drag across any of them to move the cursor; the words above each panel read its values at that time. "Day", "3 days" and "Week" set how many days the axis holds, from the day chosen in the list.',
        'The night is shaded, from sunset to sunrise. The orange line is sunset and the violet line moonrise. On today a dotted grey line marks the current time, and the cursor rests there.',
      ],
    },
    {
      heading: 'Tide',
      paragraphs: [
        "The green curve is the tide NOAA predicts for the nearest tide station, in feet above mean lower low water, with the station named under the panels. On today the white line is the level the station measured, where it has a gauge, and the second line of the reading is the difference between the two. Where the nearest gauge is another station, the caption gives that gauge's difference from its own prediction.",
        'Where NOAA publishes only the highs and lows for a station, the curve is drawn between them and the reading says "interpolated".',
        'A spot has a tide when a tide station is within 25 miles and the spot is under 300 feet. Elsewhere the panel is left out and the caption says why.',
      ],
    },
    {
      heading: 'Wind',
      paragraphs: [
        "One arrow an hour, placed at the hour's speed and pointing where the wind is going; the words say where it comes from. A dot is a calm hour, or one with no direction. Across three days or a week only some hours have an arrow, so they do not run together.",
        'The dotted line is the gusts, drawn only where they stand out from the wind: more than a quarter above it, or 5 mph or more above it. An hour whose gust does not stand out has no gust in the words either.',
        'The axis runs from zero to just above the highest gust of the days on screen.',
      ],
    },
    {
      heading: 'Temperature',
      paragraphs: [
        'The main line is the temperature. The thin grey line under it is the dew point. The dotted line is how it feels, drawn only where that is 2°F or more from the temperature. The humidity is in the words only.',
      ],
    },
    {
      heading: 'Sky',
      paragraphs: [
        "The line is cloud cover, as a share of the sky. The grey line is the chance of rain for the hour. Where today's sky is observed it is one of clear, few, scattered, broken and overcast, drawn at the middle of its range.",
      ],
    },
    {
      heading: 'Today: observed and forecast',
      paragraphs: [
        `At a spot with a weather station within ${STATION_WITHIN_MI} miles and within 500 feet of its height, the hours before the current time show what the station reported: white, heavier and dashed, with the arrows filled. The hours after it are the forecast, in green, as every other day is. The caption names the station. The chance of rain is forecast all day.`,
        'Anywhere else today is forecast only, and the caption says why.',
      ],
    },
    {
      heading: 'Where the numbers come from',
      paragraphs: [
        "The weather is the National Weather Service's forecast for the 2.5 km cell at the spot, about 7 days ahead; days past it say so in the list. The tide is NOAA's. Sunset, sunrise and the moon are worked out for the spot itself; where it is 100 feet up or more and near the sea they count its height, over a sea-level horizon, and the caption says so.",
        'Each caption under the panels says how recent its source is.',
      ],
    },
  ],
}
