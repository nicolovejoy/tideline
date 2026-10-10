import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { LatLon } from '../data/geo.ts'
import { fetchPlace } from '../data/geocode.ts'
import { fetchElevationFt, fetchPoints } from '../data/nws.ts'
import { resolveSpot } from '../data/resolve.ts'
import type { ResolveResult } from '../data/resolve.ts'
import { newSpotId } from '../data/savedSpots.ts'
import { loadStations } from '../data/stations.ts'
import type { StationRow } from '../data/stations.ts'
import type { Spot } from '../spot.ts'
import {
  NAME_MAX,
  WORDS,
  canSave,
  cleanName,
  factsLines,
  failureWords,
  searchLine,
  suggestedName,
  tidesOffReason,
} from './addSpotView.ts'
import type { SearchState } from './addSpotView.ts'
import { SpotMap } from './SpotMap.tsx'
import type { Look } from './SpotMap.tsx'

const LOCATE_TIMEOUT = 15_000

export interface AddSpotProps {
  /** The spot the user came from: where the map opens. */
  from: Spot
  onSave: (spot: Spot) => void
  onCancel: () => void
}

/**
 * A pin on a map or the device's position, a name, and what the pin gets:
 * its forecast cell, its stations and whether the tide starts shown. Loaded
 * only when opened, with Leaflet and the station list.
 */
export default function AddSpot({ from, onSave, onCancel }: AddSpotProps) {
  const [pin, setPin] = useState<LatLon | null>(null)
  const [look, setLook] = useState<Look | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [name, setName] = useState('')
  const [stations, setStations] = useState<StationRow[] | null>(null)
  const [stationsFailed, setStationsFailed] = useState(false)
  const [stationsAttempt, setStationsAttempt] = useState(0)
  const [result, setResult] = useState<ResolveResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [tidesShown, setTidesShown] = useState<boolean | null>(null)
  const [locating, setLocating] = useState<'idle' | 'finding' | 'failed'>(
    'idle',
  )
  const nameId = useId()
  const tidesId = useId()
  const placeId = useId()

  // A search that answers after the screen is gone sets nothing.
  const gone = useRef(false)
  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
    }
  }, [])

  // The list is a chunk of its own and can fail to arrive like any fetch.
  // Try again asks for it afresh.
  useEffect(() => {
    let gone = false
    loadStations().then(
      (rows) => {
        if (!gone) setStations(rows)
      },
      () => {
        if (!gone) setStationsFailed(true)
      },
    )
    return () => {
      gone = true
    }
  }, [stationsAttempt])

  // Each pin, and each try-again, looks the pin up afresh. What the last
  // look-up found is cleared by the tap that asks again, below.
  useEffect(() => {
    if (!pin || !stations) return
    let gone = false
    resolveSpot(pin.lat, pin.lon, {
      fetchPoints,
      fetchElevationFt,
      stations,
    }).then((answer) => {
      if (gone) return
      setResult(answer)
      if (answer.ok) setTidesShown(answer.facts.tidesShown)
    })
    return () => {
      gone = true
    }
  }, [pin, stations, attempt])

  const dropPin = (at: LatLon) => {
    setPin(at)
    setResult(null)
    setTidesShown(null)
  }
  const tryAgain = () => {
    setResult(null)
    // Once the list is in, the look-up below runs by itself.
    if (stationsFailed) {
      setStationsFailed(false)
      setStationsAttempt((n) => n + 1)
    } else {
      setAttempt((n) => n + 1)
    }
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (query.trim() === '' || search.status === 'searching') return
    setSearch({ status: 'searching' })
    fetchPlace(query).then(
      (place) => {
        if (gone.current) return
        if (!place) {
          setSearch({ status: 'none' })
          return
        }
        setSearch({ status: 'found', place })
        dropPin({ lat: place.lat, lon: place.lon })
        setLook({ lat: place.lat, lon: place.lon, bounds: place.bounds })
        setName((typed) => suggestedName(typed, place))
      },
      () => {
        if (!gone.current) setSearch({ status: 'failed' })
      },
    )
  }

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocating('failed')
      return
    }
    setLocating('finding')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const at = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }
        setLocating('idle')
        dropPin(at)
        setLook(at)
      },
      () => setLocating('failed'),
      { timeout: LOCATE_TIMEOUT, maximumAge: 60_000 },
    )
  }

  const save = () => {
    if (!pin || !result?.ok) return
    onSave({
      ...result.facts,
      id: newSpotId(),
      name: cleanName(name),
      tidesShown: tidesShown ?? result.facts.tidesShown,
    })
  }

  const facts = result?.ok ? factsLines(result.facts) : null
  const reason = result?.ok ? tidesOffReason(result.facts) : null

  return (
    <section className="add-spot">
      <form className="field search" onSubmit={submitSearch}>
        <label htmlFor={placeId}>{WORDS.placeLabel}</label>
        <input
          id={placeId}
          type="search"
          value={query}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          className="text-button"
          disabled={search.status === 'searching' || query.trim() === ''}
        >
          {search.status === 'searching' ? WORDS.searching : WORDS.search}
        </button>
        {/* Always rendered, so a screen reader is told when the line changes. */}
        <p className="caption search-line" role="status">
          {searchLine(search)}
        </p>
      </form>

      <div className="locate">
        <button
          type="button"
          className="text-button"
          onClick={locate}
          disabled={locating === 'finding'}
        >
          {locating === 'finding' ? WORDS.locating : WORDS.locate}
        </button>
        {locating === 'failed' && (
          <p className="caption" role="status">
            {WORDS.locateFailed}
          </p>
        )}
      </div>

      <SpotMap
        center={{ lat: from.lat, lon: from.lon }}
        pin={pin}
        look={look}
        onPick={dropPin}
      />

      <p className="field">
        <label htmlFor={nameId}>{WORDS.nameLabel}</label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </p>

      <div className="facts" aria-live="polite">
        {pin === null ? (
          <p className="caption">{WORDS.tapToStart}</p>
        ) : stationsFailed ? (
          <>
            <p className="caption">{failureWords('unreachable')}</p>
            <button type="button" className="text-button" onClick={tryAgain}>
              {WORDS.tryAgain}
            </button>
          </>
        ) : result === null ? (
          <p className="caption">{WORDS.looking}</p>
        ) : !result.ok ? (
          <>
            <p className="caption">{failureWords(result.reason)}</p>
            {result.reason === 'unreachable' && (
              <button type="button" className="text-button" onClick={tryAgain}>
                {WORDS.tryAgain}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="caption">{facts?.weather}</p>
            <p className="caption">{facts?.tide}</p>
            <p className="caption">{facts?.gauge}</p>
            <p className="field field-check">
              <input
                id={tidesId}
                type="checkbox"
                checked={tidesShown ?? false}
                onChange={(event) => setTidesShown(event.target.checked)}
              />
              <label htmlFor={tidesId}>{WORDS.showTides}</label>
              {/* Ticking the box answers the reason, so it goes. */}
              {tidesShown === false && reason && (
                <span className="caption">{reason}</span>
              )}
            </p>
          </>
        )}
      </div>

      <div className="add-actions">
        <button
          type="button"
          className="spot-choice"
          onClick={save}
          disabled={!canSave(pin, name, result)}
        >
          {WORDS.save}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>
          {WORDS.cancel}
        </button>
      </div>
    </section>
  )
}
