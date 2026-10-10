import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useEffectEvent, useRef } from 'react'
import type { LatLon } from '../data/geo.ts'
import { MAP, WORDS } from './addSpotView.ts'

/** About 30 miles across a phone's width at mid latitudes. */
const ZOOM = 10
const PIN = {
  radius: 9,
  color: '#fff',
  weight: 2,
  fillColor: '#c8401f',
  fillOpacity: 1,
}

interface SpotMapProps {
  /** Where the map opens. Read once. */
  center: LatLon
  pin: LatLon | null
  /** Somewhere to pan to when it changes, such as the device's position. */
  look: LatLon | null
  onPick: (at: LatLon) => void
}

/**
 * Leaflet on OpenStreetMap tiles, in a div it owns. A tap reports a point;
 * the pin is drawn where the parent says it is. A circle marker, not
 * Leaflet's image marker, so there is no icon file for the bundler to lose.
 */
export function SpotMap({ center, pin, look, onPick }: SpotMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  // The centre is where the map opens, not something it follows.
  const opening = useRef(center)
  // Calls the latest handler, so the map's one listener never goes stale.
  const pick = useEffectEvent((at: LatLon) => onPick(at))

  useEffect(() => {
    if (!host.current) return
    const { lat, lon } = opening.current
    const made = L.map(host.current).setView([lat, lon], ZOOM)
    L.tileLayer(MAP.tiles, { attribution: MAP.attribution, maxZoom: 19 }).addTo(
      made,
    )
    made.on('click', (event: L.LeafletMouseEvent) => {
      pick({ lat: event.latlng.lat, lon: event.latlng.lng })
    })
    map.current = made
    return () => {
      made.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    const made = map.current
    if (!made) return
    if (!pin) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (marker.current) {
      marker.current.setLatLng([pin.lat, pin.lon])
    } else {
      marker.current = L.circleMarker([pin.lat, pin.lon], PIN).addTo(made)
    }
  }, [pin])

  useEffect(() => {
    if (look && map.current) map.current.setView([look.lat, look.lon], ZOOM)
  }, [look])

  return (
    <div
      ref={host}
      className="map"
      role="application"
      aria-label={WORDS.mapLabel}
    />
  )
}
