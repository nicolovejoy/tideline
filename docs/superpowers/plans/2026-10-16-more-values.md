# Feels Like, Dew Point and Humidity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The temperature panel draws the dew point and, where it stands out, the feels-like temperature beside the temperature, and the words at the cursor say the temperature, the dew point, the humidity and the feels-like, observed and forecast by the rules the temperature already follows.

**Architecture:** Three fields join `ForecastHour` from the NWS grid and two join `Report` and `ObservedHour` from the station's reports, read by the layer and measure tables already there. A new plain rule `shownFeel` in `src/chart/feel.ts` hides the feels-like where it is within 2°F of the temperature, as `shownGust` hides a gust. `temperaturePanelParts` in `src/chart/readout.ts` words the four values; `weatherView.ts` draws the three staircases on the temperature panel with the observed rule applied to the dew point and not to the feels-like. The 14-day list is untouched.

**Tech Stack:** Vite, React 19, strict TypeScript, Vitest, plain CSS, hand-written SVG.

**Spec:** `docs/superpowers/specs/2026-10-16-more-values-design.md`. Read it first: it says what the user sees, settles the builder's questions, and lists the decisions the owner reviews on the pull request.

## Global Constraints

- Code style: no semicolons, single quotes, relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, no enums. `npm run lint` (oxlint then Prettier) must pass; run `npm run format` before committing.
- Tests run with `TZ=Asia/Tokyo`; nothing may depend on the viewer's time zone.
- Components hold no arithmetic, no rules and no wording. Those go in `src/chart/feel.ts`, `src/chart/readout.ts`, `src/ui/weatherView.ts`, `src/data/nws.ts`, `src/data/nwsObservations.ts`, `src/data/observed.ts`, each with tests.
- Field names, exactly: `feelsF`, `dewF`, `humidityPct` on `ForecastHour`; `dewF`, `humidityPct` on `Report` and `ObservedHour`. Grid layers: `apparentTemperature` (`wmoUnit:degC`), `dewpoint` (`wmoUnit:degC`), `relativeHumidity` (`wmoUnit:percent`). Report measures: `dewpoint` (`wmoUnit:degC`), `relativeHumidity` (`wmoUnit:percent`).
- Words, exactly: `72°F`, `dew point 55°F`, `57% humidity`, `feels like 78°F`, in that order, whole numbers by `whole` in `readout.ts`. Keys: `temp`, `dew`, `null`, `feels`. Series names: `dew`, `feels`, `temp` in that order, `-observed` suffixed as now. The panel's title stays `Temperature`.
- The feels-like threshold is 2°F: `FEEL_STANDS_OUT_F = 2`, shown where `Math.abs(feelsF - tempF) >= 2`.
- `OBSERVED_FIELDS` gains `dewF` and `humidityPct`, not `feelsF`.
- The cache prefix becomes `tideline:v3:`; every test string `tideline:v2:` becomes `tideline:v3:`.
- In every tracked file and commit message the first user is "the first user"; no names from `private/`.
- Commit messages are one imperative line, as the repo's are, with the trailer on every commit, regardless of the model doing the work:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Node 24. In each shell, before any `npm` or `npx`: `export PATH=/Users/nico/.nvm/versions/node/v24.21.0/bin:$PATH`. Do not `source` nvm.
- Work in `/Users/nico/src/tideline` on the branch `feat/more-values`, which is checked out there. No `git stash`, `git reset`, `git checkout` of other branches, or `git clean`.

## Review Focus

1. A grid hour with a temperature and no apparent temperature (NWS's `apparentTemperature` has one more value than `temperature` at Campus Point, and the dew point runs out an hour earlier): `shownFeel` must be null, the dew point line must break, and the words must leave the part out. Pinned in Task 3 (`shownFeel` with a null) and Task 4 (an hour with `dewF` null).
2. A feels-like exactly 2°F from the temperature is shown; 1.9°F is hidden. Pinned in Task 3.
3. On today with a station, a row whose dew point failed its quality flag: the row's temperature is observed, the hour's dew point is the forecast's, and the words say "72°F, observed, dew point 52°F, 61% humidity, feels like 78°F, forecast" with the three forecast parts in one run. Pinned in Task 4.
4. The vertical range must take in a dew point far below the temperature (La Cumbre Peak, 20°F) and a hidden feels-like, so the panel does not jump between days or as a feels-like comes and goes. Pinned in Task 4.
5. A saved forecast from before this change must fail `isForecast`, and a saved observed day `isObservedDay`, so the app fetches afresh rather than drawing an hour with `undefined` fields. Pinned in Task 1 and Task 2.

---

### Task 1: The forecast's three new fields

**Files:**
- Modify: `src/data/nws.ts` (`ForecastHour`, `LAYERS`, `emptyHour`)
- Modify: `src/data/nws.test.ts` (`sample()`, the parse tests, `isForecast`)
- Modify, literals only (add `feelsF: null, dewF: null, humidityPct: null` to every `ForecastHour` literal so the build stays green): `src/chart/arrows.test.ts`, `src/chart/readout.test.ts` (the `hour` helper and `NOTHING`), `src/data/useSpotData.test.ts`, `src/ui/dayList.test.ts`, `src/ui/weatherView.test.ts` (the `hourly` helper), `src/ui/weatherView.ts` (`asForecastHour`: the three as `null` for now; Task 2 fills two of them)

**Interfaces:**
- Produces: `ForecastHour` gains `feelsF: number | null`, `dewF: number | null`, `humidityPct: number | null`, in that order after `rainPct`. `LAYERS` gains `feelsF: { layer: 'apparentTemperature', unit: 'wmoUnit:degC', convert: celsiusToF }`, `dewF: { layer: 'dewpoint', unit: 'wmoUnit:degC', convert: celsiusToF }`, `humidityPct: { layer: 'relativeHumidity', unit: 'wmoUnit:percent', convert: asIs }`. `parseGridpoint` and `isForecast` follow from the table.

- [ ] **Step 1: Write the failing tests**

In `src/data/nws.test.ts`, add to `sample()`'s properties:

```ts
      apparentTemperature: {
        uom: 'wmoUnit:degC',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT2H', value: 25 }],
      },
      dewpoint: {
        uom: 'wmoUnit:degC',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 10 }],
      },
      relativeHumidity: {
        uom: 'wmoUnit:percent',
        values: [{ validTime: '2026-10-08T08:00:00+00:00/PT3H', value: 57 }],
      },
```

Add to `describe('parseGridpoint')`:

```ts
  test('the feels-like, the dew point and the humidity, in °F and percent', () => {
    const { hours } = parseGridpoint(sample())
    expect(hours[0].feelsF).toBeCloseTo(77, 5)
    expect(hours[0].dewF).toBeCloseTo(50, 5)
    expect(hours[0].humidityPct).toBe(57)
    // The apparent temperature was given for two hours only.
    expect(hours[2].feelsF).toBeNull()
    expect(hours[2].dewF).toBeCloseTo(50, 5)
  })

  test('a real response carries all three for most hours', () => {
    const { hours } = parseGridpoint(JSON.parse(realRaw))
    const has = (field: 'feelsF' | 'dewF' | 'humidityPct') =>
      hours.filter((hour) => hour[field] !== null).length
    expect(has('feelsF')).toBeGreaterThan(100)
    expect(has('dewF')).toBeGreaterThan(100)
    expect(has('humidityPct')).toBeGreaterThan(100)
    const first = hours.find((hour) => hour.dewF !== null)!
    expect(first.dewF).toBeLessThan(first.tempF!)
  })
```

Add to `describe('isForecast')`:

```ts
  test('a forecast saved before the feels-like, dew point and humidity fails, so it is fetched afresh', () => {
    const old = parseGridpoint(sample()).hours.map((hour) => {
      const { feelsF, dewF, humidityPct, ...rest } = hour
      void feelsF
      void dewF
      void humidityPct
      return rest
    })
    expect(isForecast({ updatedAt: EIGHT, hours: old })).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/nws.test.ts`
Expected: the three new tests fail (`feelsF` undefined, `isForecast` true); the build of other test files may also fail on the missing fields, which Step 3 fixes.

- [ ] **Step 3: Implement**

Add the three fields to `ForecastHour`, the three rows to `LAYERS` and the three nulls to `emptyHour` in `src/data/nws.ts`. Add the three nulls to every `ForecastHour` literal listed under Files; in `src/ui/weatherView.ts` `asForecastHour` gives all three as `null` for now.

- [ ] **Step 4: Run the whole suite and the type check**

Run: `npx vitest run && npm run build`
Expected: all pass, no type errors.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/data/nws.ts src/data/nws.test.ts src/chart/arrows.test.ts src/chart/readout.test.ts src/data/useSpotData.test.ts src/ui/dayList.test.ts src/ui/weatherView.test.ts src/ui/weatherView.ts
git commit -m "Read the feels-like, the dew point and the humidity from the NWS grid" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The station's dew point and humidity, and the cache version

**Files:**
- Modify: `src/data/nwsObservations.ts` (`Report`, `parseObservations`)
- Modify: `src/data/nwsObservations.test.ts`
- Modify: `src/data/observed.ts` (`ObservedHour`, `row`, `isObservedHour`)
- Modify: `src/data/observed.test.ts` (the `report` helper, `isObservedDay`)
- Modify: `src/ui/weatherView.ts` (`asForecastHour` carries `dewF` and `humidityPct` from the row)
- Modify, literals only (add `dewF: null, humidityPct: null` to every `Report` and `ObservedHour` literal): `src/ui/weatherView.test.ts` (the `observed` helper), `src/ui/captions.test.ts`, `src/data/nwsObservations.test.ts`
- Modify: `src/data/cache.ts` (the prefix and its comment), and every `tideline:v2:` string in `src/data/cache.test.ts`, `src/data/savedSpots.test.ts`, `src/ui/choices.test.ts`

**Interfaces:**
- Produces: `Report` and `ObservedHour` gain `dewF: number | null` and `humidityPct: number | null` after `tempF`. `row` in `observed.ts` takes them from `base` as it takes `tempF`. `isObservedHour` checks `number('dewF')` and `number('humidityPct')`. `PREFIX` is `'tideline:v3:'` with the comment: "v3: the forecast and the observed rows carry the feels-like, the dew point and the humidity."

- [ ] **Step 1: Write the failing tests**

In `src/data/nwsObservations.test.ts`, in `describe('parseObservations')`:

```ts
  test('the dew point in °F and the humidity in percent', () => {
    // 6 °C and 37.6% in the first KSBA report.
    expect(ksba[0].dewF).toBeCloseTo(42.8, 5)
    expect(ksba[0].humidityPct).toBeCloseTo(37.638, 3)
  })

  test('a dew point flagged bad is left out and the temperature stands', () => {
    const json = JSON.parse(ksbaRaw)
    json.features[0].properties.dewpoint.qualityControl = 'X'
    const [first] = parseObservations(json)
    expect(first.dewF).toBeNull()
    expect(first.tempF).toBeCloseTo(66.2, 5)
  })
```

In `src/data/observed.test.ts`, extend the `report` helper's defaults with `dewF: 50, humidityPct: 70`, and add to `describe('observedHours')`:

```ts
  test("the row's dew point and humidity come from the same report as its temperature", () => {
    const reports = [
      report(NINE - 20 * MINUTE, { tempF: 50, dewF: 40, humidityPct: 60 }),
      report(NINE + 5 * MINUTE, { tempF: 55, dewF: 45, humidityPct: 65 }),
    ]
    const [row] = observedHours(reports, DAY, START + 11 * HOUR)
    expect(row.tempF).toBe(55)
    expect(row.dewF).toBe(45)
    expect(row.humidityPct).toBe(65)
  })
```

And in `describe('isObservedDay')`:

```ts
  test('rows saved before the dew point and humidity fail, so the day is fetched afresh', () => {
    const old = {
      stationId: 'KSBA',
      through: null,
      hours: [{ t: 1, tempF: 60, windMph: 5, gustMph: null, windDeg: 180, sky: null }],
    }
    expect(isObservedDay(old)).toBe(false)
  })
```

In `src/data/cache.test.ts`, change `KEY` and every other `tideline:v2:` to `tideline:v3:` (and in `savedSpots.test.ts` and `choices.test.ts`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/nwsObservations.test.ts src/data/observed.test.ts src/data/cache.test.ts`
Expected: the new tests fail; the cache tests fail on the key.

- [ ] **Step 3: Implement**

`parseObservations`: `const dew = measure('dewpoint', p.dewpoint, 'wmoUnit:degC')` and `humidityPct: measure('relativeHumidity', p.relativeHumidity, 'wmoUnit:percent')`, `dewF: dew === null ? null : celsiusToF(dew)`. `row`: `dewF: base?.dewF ?? null, humidityPct: base?.humidityPct ?? null`. `isObservedHour`: the two `number(...)` checks. `asForecastHour` in `weatherView.ts`: `dewF: row.dewF, humidityPct: row.humidityPct`, `feelsF: null`. The literals. The prefix.

- [ ] **Step 4: Run the whole suite and the type check**

Run: `npx vitest run && npm run build`
Expected: all pass.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/data/nwsObservations.ts src/data/nwsObservations.test.ts src/data/observed.ts src/data/observed.test.ts src/ui/weatherView.ts src/ui/weatherView.test.ts src/ui/captions.test.ts src/data/cache.ts src/data/cache.test.ts src/data/savedSpots.test.ts src/ui/choices.test.ts
git commit -m "Keep the station's dew point and humidity in the observed rows, and bump the cache" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The feels-like rule and the panel's words

**Files:**
- Create: `src/chart/feel.ts`
- Create: `src/chart/feel.test.ts`
- Modify: `src/chart/readout.ts` (add `temperaturePanelParts` after `tempParts`)
- Modify: `src/chart/readout.test.ts`

**Interfaces:**
- Consumes: `ForecastHour` from Task 1; `part`, `whole`, `ReadoutPart`, `SourceWord` in `readout.ts`.
- Produces, in `src/chart/feel.ts`:
  - `export const FEEL_STANDS_OUT_F = 2`
  - `export function shownFeel(hour: ForecastHour): number | null`: the hour's `feelsF` where both it and `tempF` are numbers and `Math.abs(feelsF - tempF) >= FEEL_STANDS_OUT_F`; null otherwise, including where `tempF` is null.
  - In `readout.ts`: `export function temperaturePanelParts(hour: ForecastHour | null, source?: SourceWord): ReadoutPart[]`, the parts `temp` (`72°F`), `dew` (`dew point 55°F`), `null` (`57% humidity`), `feels` (`feels like 78°F`, from `shownFeel`), each only where the hour has it, all carrying `source` where given. `tempParts` is unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/chart/feel.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { FEEL_STANDS_OUT_F, shownFeel } from './feel.ts'
import type { ForecastHour } from '../data/nws.ts'

function hour(change: Partial<ForecastHour>): ForecastHour {
  return {
    t: 0,
    tempF: 70,
    windMph: 5,
    gustMph: null,
    windDeg: 180,
    cloudPct: 10,
    rainPct: 0,
    feelsF: 70,
    dewF: 50,
    humidityPct: 50,
    ...change,
  }
}

describe('shownFeel', () => {
  test('the threshold is two degrees', () => {
    expect(FEEL_STANDS_OUT_F).toBe(2)
  })

  test('the feels-like where it stands out from the temperature, else none', () => {
    expect(shownFeel(hour({ tempF: 70, feelsF: 78 }))).toBe(78)
    expect(shownFeel(hour({ tempF: 70, feelsF: 72 }))).toBe(72)
    expect(shownFeel(hour({ tempF: 70, feelsF: 68 }))).toBe(68)
    expect(shownFeel(hour({ tempF: 70, feelsF: 71.9 }))).toBeNull()
    expect(shownFeel(hour({ tempF: 70, feelsF: 70 }))).toBeNull()
  })

  test('nothing to set it against, or no feels-like, is none', () => {
    expect(shownFeel(hour({ tempF: null, feelsF: 78 }))).toBeNull()
    expect(shownFeel(hour({ feelsF: null }))).toBeNull()
  })
})
```

In `src/chart/readout.test.ts`, inside `describe('the weather under the cursor')`, set the `hour` helper's defaults to `feelsF: 73.6, dewF: 55.4, humidityPct: 56.6` (and `NOTHING`'s three to null, done in Task 1), import `temperaturePanelParts`, and add:

```ts
  describe('temperaturePanelParts', () => {
    test('the temperature, the dew point, the humidity and the feels-like where it stands out', () => {
      expect(temperaturePanelParts(hour(NOON, { feelsF: 78.2 }))).toEqual([
        { key: 'temp', text: '74°F' },
        { key: 'dew', text: 'dew point 55°F' },
        { key: null, text: '57% humidity' },
        { key: 'feels', text: 'feels like 78°F' },
      ])
    })

    test('a feels-like within two degrees is left out of the words', () => {
      expect(partsText(temperaturePanelParts(hour(NOON)))).toBe(
        '74°F, dew point 55°F, 57% humidity',
      )
    })

    test('each part only where the hour has it', () => {
      expect(
        partsText(temperaturePanelParts(hour(NOON, { dewF: null, humidityPct: null }))),
      ).toBe('74°F')
      expect(
        partsText(temperaturePanelParts(hour(NOON, { tempF: null, feelsF: 80 }))),
      ).toBe('dew point 55°F, 57% humidity')
      expect(temperaturePanelParts(null)).toEqual([])
      expect(temperaturePanelParts(NOTHING)).toEqual([])
    })

    test('carries the source on every part', () => {
      expect(
        temperaturePanelParts(hour(NOON, { feelsF: 78 }), 'forecast').map((p) => p.source),
      ).toEqual(['forecast', 'forecast', 'forecast', 'forecast'])
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/chart/feel.test.ts src/chart/readout.test.ts`
Expected: FAIL, `feel.ts` not found and `temperaturePanelParts` not exported.

- [ ] **Step 3: Implement**

`src/chart/feel.ts` with a doc comment in the style of `shownGust`'s. `temperaturePanelParts` in `readout.ts`, importing `shownFeel` from `./feel.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/chart/feel.test.ts src/chart/readout.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/chart/feel.ts src/chart/feel.test.ts src/chart/readout.ts src/chart/readout.test.ts
git commit -m "Add the feels-like rule and the temperature panel's words" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The temperature panel draws and reads the three values

**Files:**
- Modify: `src/ui/weatherView.ts`
- Modify: `src/ui/weatherView.test.ts`

**Interfaces:**
- Consumes: `shownFeel` from Task 3; `temperaturePanelParts` from Task 3; the fields from Tasks 1 and 2.
- Produces, in `weatherView.ts`:
  - `TEMP.fields` is `[['dew', 'dewF'], ['feels', 'feelsF'], ['temp', 'tempF']]` and `TEMP.dots` the same three.
  - `OBSERVED_FIELDS` gains `'dewF'` and `'humidityPct'`.
  - `withShownGusts` becomes `withShownValues<T extends ForecastHour | null>(hour: T): T`, setting `gustMph: shownGust(hour)` and `feelsF: shownFeel(hour)`. Every caller renamed.
  - `tempBounds` is `steppedBounds(values([...all, ...observedHours], ['tempF', 'feelsF', 'dewF']), 10)`, computed from the hours as given (before `withShownValues`), as the wind's is.
  - `readoutFor`'s `temp` is built per part: where `at.observed` is null, `temperaturePanelParts(at.forecast, forecast)`; otherwise the parts of `temperaturePanelParts(at.observed, 'observed')` for the fields the row stands for (`rowStands(at, 'tempF')`, `'dewF'`, `'humidityPct'`) and the parts of `temperaturePanelParts(at.forecast, forecast)` for the fields it does not, in the fixed order temp, dew, humidity, feels, with the feels-like always from the forecast. Implement it by building the forecast's and the row's part lists and picking by key (`temp`, `dew`, `null`, `feels`) per field; the feels-like part is the forecast's.

- [ ] **Step 1: Write the failing tests**

In `src/ui/weatherView.test.ts`: set the `hourly` helper's defaults to `feelsF: 50 + (((t - START) / HOUR) % 24)` (equal to the temperature, so hidden), `dewF: 45`, `humidityPct: 60`; the `observed` helper's to `dewF: 48, humidityPct: 65`. Update the existing name lists: `['temp']` becomes `['dew', 'feels', 'temp']` at lines 93 and 675, and `['temp-observed', 'temp']` becomes `['dew-observed', 'dew', 'feels', 'temp-observed', 'temp']` at line 515; the existing readout expectations `'74°F, observed'` become `'74°F, dew point 48°F, 65% humidity, observed'` and `'65°F, forecast'` become `'65°F, dew point 45°F, 60% humidity, forecast'` (the `words` string at line 712 likewise), and the dot lists gain `{ name: 'dew-observed', v: 48 }` before the temp dot on the observed side and `{ name: 'dew', v: 45 }` before it on the forecast side. Every existing test that picks the temperature's series by position (`view.temp.series[0]`, `const [obs, fc] = ….temp.series`) must pick it by name instead, with a helper at the top of the file: `const named = (series: Series[], name: string) => series.find((s) => s.name === name)!` (import `Series` as a type from `../chart/Panel.tsx`), so `temps` is `named(view.temp.series, 'temp').points` and the station tests take `named(…, 'temp-observed')` and `named(…, 'temp')`. Then add to `describe('what is drawn')`:

```ts
  test('the dew point is a staircase under the temperature, and the feels-like is drawn only where it stands out', () => {
    const warm = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === START + 14 * HOUR) hour.feelsF = hour.tempF! + 6
      }),
    )
    const view = weatherView(warm, day(0), NOW, NOW)
    const [dew, feels, temp] = view.temp.series
    expect(dew.points).toHaveLength(19)
    expect(dew.points[0]).toEqual({ t: FIRST, v: 45 })
    expect(feels.points).toEqual([{ t: START + 14 * HOUR, v: 70 }])
    expect(temp.points).toHaveLength(19)
  })

  test('an hour with no dew point leaves a break in its line and no part in the words', () => {
    const gap = START + 10 * HOUR
    const patchy = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === gap) hour.dewF = null
      }),
    )
    const view = weatherView(patchy, day(0), gap + 30 * MINUTE, NOW)
    expect(view.temp.series[0].points.map((p) => p.t)).not.toContain(gap)
    expect(partsText(view.temp.readout)).toBe('60°F, 60% humidity')
    expect(view.temp.dots).toEqual([{ name: 'temp', v: 60 }])
  })

  test('the range takes in the dew point and the feels-like whole, hidden or not', () => {
    const dry = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.dewF = 21
        if (hour.t === START + 14 * HOUR) hour.feelsF = 99
      }),
    )
    const view = weatherView(dry, day(3), NOW, NOW)
    expect(view.temp.bounds).toEqual([20, 100])
  })

  test('at the cursor the words and the dots say all four, the feels-like where shown', () => {
    const warm = loaded(
      hourly(FIRST, 185, (hour) => {
        if (hour.t === START + 14 * HOUR) hour.feelsF = hour.tempF! + 6
      }),
    )
    const view = weatherView(warm, day(0), START + 14 * HOUR + 30 * MINUTE, NOW)
    expect(partsText(view.temp.readout)).toBe(
      '64°F, dew point 45°F, 60% humidity, feels like 70°F',
    )
    expect(view.temp.dots).toEqual([
      { name: 'dew', v: 45 },
      { name: 'feels', v: 70 },
      { name: 'temp', v: 64 },
    ])
  })
```

And to `describe('today with a station')`:

```ts
  test('the observed dew point is cut at the line as the temperature is, and the feels-like is forecast whole', () => {
    const warm = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.feelsF = hour.tempF! + 6
      }),
    )
    const view = weatherView(warm, day(0), NOW, NOW, rows)
    const [dewObs, dew, feels, tempObs] = view.temp.series
    expect(dewObs.points).toHaveLength(16)
    expect(dewObs.points[0]).toEqual({ t: START, v: 48 })
    expect(dewObs.cut).toEqual({ at: NOW, keep: 'before' })
    expect(dew.points[0].t).toBe(START + 15 * HOUR)
    expect(dew.cut).toEqual({ at: NOW, keep: 'after' })
    expect(feels.cut).toBeUndefined()
    expect(feels.points[0].t).toBe(FIRST)
    expect(tempObs.cut).toEqual({ at: NOW, keep: 'before' })
  })

  test('left of the line the words run the observed parts together and the feels-like after them, as forecast', () => {
    const warm = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.feelsF = hour.tempF! + 6
      }),
    )
    const cursor = START + 14 * HOUR + 30 * MINUTE
    const view = weatherView(warm, day(0), cursor, NOW, rows)
    expect(partsText(view.temp.readout)).toBe(
      '74°F, dew point 48°F, 65% humidity, observed; feels like 70°F, forecast',
    )
    expect(view.temp.dots).toEqual([
      { name: 'dew-observed', v: 48 },
      { name: 'feels', v: 70 },
      { name: 'temp-observed', v: 74 },
    ])
  })

  test('a row whose dew point was dropped reads the forecast dew point and humidity, in one forecast run with the feels-like', () => {
    const warm = loaded(
      hourly(FIRST, 185, (hour) => {
        hour.feelsF = hour.tempF! + 6
      }),
    )
    const blind = observed(NOW, (row) => {
      if (row.t === START + 14 * HOUR) {
        row.dewF = null
        row.humidityPct = null
      }
    })
    const cursor = START + 14 * HOUR + 30 * MINUTE
    const view = weatherView(warm, day(0), cursor, NOW, blind)
    expect(partsText(view.temp.readout)).toBe(
      '74°F, observed; dew point 45°F, 60% humidity, feels like 70°F, forecast',
    )
    expect(view.temp.dots).toEqual([
      { name: 'dew', v: 45 },
      { name: 'feels', v: 70 },
      { name: 'temp-observed', v: 74 },
    ])
  })
```

(`MINUTE` is already defined at the top of the file; `partsText` is imported.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/weatherView.test.ts`
Expected: the new tests and the updated name lists fail.

- [ ] **Step 3: Implement**

As under Interfaces. `dotsFor` needs no change beyond `TEMP.dots`: a hidden feels-like is null on the hour after `withShownValues`, so it gives no dot, as a hidden gust does; `rowStands(at, 'feelsF')` is false since it is not observed, so the dot is the forecast's. Note that `rowStands` for `humidityPct` matters only to the words.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run && npm run build`
Expected: all pass.

- [ ] **Step 5: Lint and commit**

```bash
npm run format && npm run lint
git add src/ui/weatherView.ts src/ui/weatherView.test.ts
git commit -m "Draw the dew point and the feels-like on the temperature panel and say all four at the cursor" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The lines' looks, and a browser check

**Files:**
- Modify: `src/styles.css` (the `.key-*`, `.series-*` and `.dot-*` rules)

**Interfaces:**
- Produces, CSS only: `.key-dew, .key-feels { --key: var(--muted); }` beside `.key-gust`; `.series-dew .line { stroke: var(--muted); stroke-width: 1.5; }`; `.series-feels .line { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 0.5 3.5; }` (the gust's look); `.series-dew-observed .line { stroke: var(--observed); stroke-width: 3.5; }` beside `.series-temp-observed`; `.dot-dew, .dot-feels { fill: var(--muted); }`; `.dot-dew-observed { fill: var(--observed); }`. Fold each into the existing grouped selectors where one exists (`.series-gust .line, .series-rain .line` and so on) rather than repeating declarations.

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Build and lint**

Run: `npm run format && npm run lint && npm run build && npx vitest run`
Expected: all pass.

- [ ] **Step 3: Check in a browser**

Start `npx vite --port 5182` in the background and open http://localhost:5182 in a Playwright browser (the `mcp__playwright__*` tools), at 393 px wide. Screenshots go in `.playwright-mcp/` (gitignored). Check:

1. Campus Point, today: the temperature panel has a thin muted line under the heavy temperature line (the dew point), observed heavy to the line at the current time and thin after it. The readout reads like "68°F, dew point 55°F, 64% humidity, observed" left of the line and "…, forecast" right of it. No dotted feels-like unless the forecast has one 2°F off.
2. La Cumbre Peak: the dew point line far below the temperature, the panel's rules reaching down to it (20°F or so), the words with a dew point and humidity and no "observed".
3. "Week": three lines across seven days, nothing printing over anything.
4. The vertical range is the same on every day of a spot.
5. Clear `localStorage` for the origin before step 1 (an old saved forecast fails the check and is fetched; confirm the screen draws without an error in the console).

Record what passed and what did not in the task's report. A failure is fixed before the commit.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "Give the dew point and the feels-like their lines, keys and dots" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The record

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Edit `CLAUDE.md`**

- The "Built:" status line: after the span control's sentence (ending "since a week has seven sunsets."), add: "Then the dew point and the feels-like on the temperature panel (issue 8's second bullet, 2026-10-16): the dew point a thin line, the feels-like dotted and only where it is 2°F or more from the temperature (`shownFeel` in `src/chart/feel.ts`), the words "72°F, dew point 55°F, 57% humidity, feels like 78°F" (`temperaturePanelParts` in `src/chart/readout.ts`), the dew point and the humidity observed where a station serves and the feels-like forecast all day; waves are not in the grid for a land cell (issue 71)."
- Product rules, "Today's weather": "the wind, temperature and sky" becomes "the wind, temperature, dew point, humidity and sky".
- Stack, the "Weather is drawn as staircases" bullet: after the gust sentence add "The feels-like follows the same pattern on the temperature panel: dotted, and only where it is 2°F or more from the temperature (`shownFeel` in `src/chart/feel.ts`); the dew point is a thin line; the humidity is in the words only."
- Data sources, NWS: after "How fine each value is" add "`apparentTemperature`, `dewpoint` and `relativeHumidity` run the whole week at one to three hours a value; `heatIndex` is sparse and `windChill` nearly all null. Every wave and swell layer is one zero across the week in the three spots' cells, which are land cells (checked 2026-10-16); the marine forecast is issue 71." Under Observations add "A report carries `dewpoint` (°C) and `relativeHumidity` (percent) with their own quality flags."
- Next Steps, phase 4: issue 8's second bullet is built on `feat/more-values`, pull request to come, with the owner's check on production; what is left of issue 8 is pinch and two-finger drag; waves are issue 71.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Record the temperature panel's new values in CLAUDE.md" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
