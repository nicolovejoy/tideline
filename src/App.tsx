import { CAMPUS_POINT } from './spot.ts'

export default function App() {
  const { name, tideStation } = CAMPUS_POINT
  return (
    <main>
      <h1>{name}</h1>
      <p>
        Tide station: NOAA {tideStation.id} {tideStation.name},{' '}
        {tideStation.distanceMi} mi {tideStation.direction}
      </p>
      <p>Nothing else here yet.</p>
    </main>
  )
}
