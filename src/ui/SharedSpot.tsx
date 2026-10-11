import { useEffect, useMemo, useState } from 'react'
import { fetchElevationFt, fetchPoints } from '../data/nws.ts'
import { resolveSpot } from '../data/resolve.ts'
import type { ResolveResult } from '../data/resolve.ts'
import { loadStations } from '../data/stations.ts'
import type { StationRow } from '../data/stations.ts'
import { fetchPointElevationFt } from '../data/usgs.ts'
import type { Spot } from '../spot.ts'
import { SHARE, lookupLine, sharedSpotId } from './shareView.ts'
import type { SharedPoint } from './shareView.ts'
import { SpotScreen } from './SpotScreen.tsx'

interface SharedSpotProps {
  /** What the link carried. */
  point: SharedPoint
  onSave: (spot: Spot) => void
  onClose: () => void
}

/**
 * A spot opened from a link, at a point the device has no spot at. The
 * point is looked up as a pin on the add screen is, then drawn as any spot
 * is. Nothing is kept until Save.
 */
export function SharedSpot({ point, onSave, onClose }: SharedSpotProps) {
  const [stations, setStations] = useState<StationRow[] | null>(null)
  const [stationsFailed, setStationsFailed] = useState(false)
  const [stationsAttempt, setStationsAttempt] = useState(0)
  const [result, setResult] = useState<ResolveResult | null>(null)
  const [attempt, setAttempt] = useState(0)

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

  // The point, and each try-again, is looked up afresh. What the last
  // look-up found is cleared by the tap that asks again, below.
  useEffect(() => {
    if (!stations) return
    let gone = false
    resolveSpot(point.lat, point.lon, {
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
  }, [point, stations, attempt])

  const tryAgain = () => {
    setResult(null)
    // Once the list is in, the look-up above runs by itself.
    if (stationsFailed) {
      setStationsFailed(false)
      setStationsAttempt((n) => n + 1)
    } else {
      setAttempt((n) => n + 1)
    }
  }

  // One object for as long as the answer stands: the screen below loads by
  // it, and a new one each time this draws would start it over.
  const spot = useMemo<Spot | null>(
    () =>
      result?.ok
        ? { ...result.facts, id: sharedSpotId(point), name: point.name }
        : null,
    [result, point],
  )
  const line = lookupLine(stationsFailed, result)

  return (
    <>
      <h1>{point.name}</h1>
      <p className="notice">{SHARE.notice}</p>
      <div className="add-actions">
        <button
          type="button"
          className="spot-choice"
          onClick={() => spot && onSave(spot)}
          disabled={spot === null}
        >
          {SHARE.save}
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          {SHARE.close}
        </button>
      </div>
      {/* Always rendered, so a screen reader is told when the line changes.
          The spot's screen is outside it, or all of it would be read out. */}
      <div className="facts" aria-live="polite">
        {line && (
          <>
            <p className="caption">{line.words}</p>
            {line.tryAgain && (
              <button type="button" className="text-button" onClick={tryAgain}>
                {SHARE.tryAgain}
              </button>
            )}
          </>
        )}
      </div>
      {spot && <SpotScreen spot={spot} />}
    </>
  )
}
