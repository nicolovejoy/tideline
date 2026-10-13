import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { LatLon } from '../data/geo.ts'
import { fetchPlace } from '../data/geocode.ts'
import type { Bounds } from '../data/geocode.ts'
import { fetchElevationFt, fetchPoints } from '../data/nws.ts'
import { resolveSpot } from '../data/resolve.ts'
import type { ResolveResult } from '../data/resolve.ts'
import { newSpotId } from '../data/savedSpots.ts'
import { loadStations } from '../data/stations.ts'
import type { StationRow } from '../data/stations.ts'
import { fetchPointElevationFt } from '../data/usgs.ts'
import type { Spot } from '../spot.ts'
import {
  NAME_MAX,
  WORDS,
  canSave,
  canSearch,
  cleanName,
  factsLines,
  edited,
  failureWords,
  pinMoved,
  removeQuestion,
  searchLine,
  spotFacts,
  suggestedName,
} from './addSpotView.ts'
import type { SearchState } from './addSpotView.ts'
import { SpotMap } from './SpotMap.tsx'
import type { Look } from './SpotMap.tsx'

const LOCATE_TIMEOUT = 15_000

export interface AddSpotProps {
  /** The spot the user came from: where the map opens. */
  from: Spot
  /** The spot being edited, when the screen is for one. The pin starts at it. */
  editing?: Spot
  onSave: (spot: Spot) => void
  onCancel: () => void
  /** Given with `editing`: the spot can be removed from here. */
  onRemove?: () => void
}

/**
 * A pin on a map or the device's position, a name, and what the pin gets:
 * its forecast cell, its height, and its stations or why it has no tide.
 * For a spot being edited the pin, the name and the facts start from the
 * spot, and nothing is looked up until the pin moves. Loaded only when
 * opened, with Leaflet and the station list.
 */
export default function AddSpot({
  from,
  editing,
  onSave,
  onCancel,
  onRemove,
}: AddSpotProps) {
  // What is known of the spot being edited, shown until the pin moves and
  // again if it comes back.
  const known: ResolveResult | null = editing
    ? { ok: true, facts: spotFacts(editing) }
    : null
  const [pin, setPin] = useState<LatLon | null>(
    editing ? { lat: editing.lat, lon: editing.lon } : null,
  )
  const [look, setLook] = useState<Look | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [name, setName] = useState(editing?.name ?? '')
  const [stations, setStations] = useState<StationRow[] | null>(null)
  const [stationsFailed, setStationsFailed] = useState(false)
  const [stationsAttempt, setStationsAttempt] = useState(0)
  const [result, setResult] = useState<ResolveResult | null>(known)
  const [attempt, setAttempt] = useState(0)
  const [locating, setLocating] = useState<'idle' | 'finding' | 'failed'>(
    'idle',
  )
  // Removing asks once, on the line itself.
  const [removing, setRemoving] = useState(false)
  const nameId = useId()
  const placeId = useId()

  // What the map shows, for a search to prefer. Nothing is drawn from it.
  const view = useRef<Bounds | null>(null)

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
  // look-up found is cleared by the tap that asks again, below. A spot
  // being edited is already known: its pin is looked up only once moved.
  useEffect(() => {
    if (!pin || !stations) return
    if (editing && !pinMoved(editing, pin)) return
    let gone = false
    resolveSpot(pin.lat, pin.lon, {
      fetchPoints,
      fetchElevationFt,
      fetchPointElevationFt,
      stations,
    }).then((answer) => {
      if (!gone) setResult(answer)
    })
    return () => {
      gone = true
    }
  }, [pin, stations, attempt, editing])

  const dropPin = (at: LatLon) => {
    setPin(at)
    // Back on the spot's own point, what was saved for it stands.
    setResult(editing && !pinMoved(editing, at) ? known : null)
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
    if (!canSearch(query, search)) return
    setSearch({ status: 'searching' })
    fetchPlace(query, view.current).then(
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

  // For an edit, what Save would do. Null when it cannot save yet.
  const edit =
    editing && pin ? edited(editing, name, pin, result, newSpotId()) : null
  const save = () => {
    if (!pin) return
    if (editing) {
      if (edit === null) return
      // Nothing changed: the screen closes, as Cancel does.
      if (edit.kind === 'nothing') onCancel()
      else onSave(edit.spot)
      return
    }
    if (!result?.ok) return
    onSave({ ...result.facts, id: newSpotId(), name: cleanName(name) })
  }
  const saveable = editing ? edit !== null : canSave(pin, name, result)

  const facts = result?.ok ? factsLines(result.facts) : []

  return (
    <section className="add-spot">
      <form className="field search" onSubmit={submitSearch}>
        <label htmlFor={placeId}>{WORDS.placeLabel}</label>
        <input
          id={placeId}
          type="search"
          value={query}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          className="text-button"
          disabled={!canSearch(query, search)}
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
        center={{ lat: (editing ?? from).lat, lon: (editing ?? from).lon }}
        pin={pin}
        look={look}
        onPick={dropPin}
        onView={(shown) => {
          view.current = shown
        }}
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
          facts.map((line) => (
            <p className="caption" key={line}>
              {line}
            </p>
          ))
        )}
      </div>

      <div className="add-actions">
        <button
          type="button"
          className="spot-choice"
          onClick={save}
          disabled={!saveable}
        >
          {WORDS.save}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>
          {WORDS.cancel}
        </button>
      </div>
      {onRemove &&
        (removing ? (
          <p className="caption remove-spot">
            <span>{removeQuestion(editing?.name ?? '')}</span>{' '}
            <button type="button" className="text-button" onClick={onRemove}>
              {WORDS.removeYes}
            </button>{' '}
            <span aria-hidden="true">{WORDS.separator}</span>{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => setRemoving(false)}
            >
              {WORDS.removeNo}
            </button>
          </p>
        ) : (
          <p className="caption remove-spot">
            <button
              type="button"
              className="text-button"
              onClick={() => setRemoving(true)}
            >
              {WORDS.remove}
            </button>
          </p>
        ))}
    </section>
  )
}
