// The forecast recorder's Node entry, run hourly by .github/workflows/record.yml.
// It wires the real Firestore (admin SDK) and NWS fetchers into recordOnce
// (src/data/recorder.ts) and prints ids only, nothing from users' documents.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { recordOnce } from '../src/data/recorder.ts'
import type { RecorderFetch, RecorderStore } from '../src/data/recorder.ts'
import type { PlaceDoc } from '../src/data/history.ts'
import { fetchForecast } from '../src/data/nws.ts'
import { fetchObservations } from '../src/data/nwsObservations.ts'
import { fetchStations } from '../src/data/nwsStations.ts'

const USER_AGENT = 'tideline (https://tideline.ibuild4you.com)'

const key = process.env.FIREBASE_SERVICE_ACCOUNT
if (!key) {
  console.error('FIREBASE_SERVICE_ACCOUNT is not set')
  process.exit(1)
}

// Every request carries the recorder's name, as NWS asks.
const plainFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const headers = new Headers(init?.headers)
  headers.set('User-Agent', USER_AGENT)
  return plainFetch(input, { ...init, headers })
}

const app = initializeApp({
  credential: cert(JSON.parse(key)),
  projectId: 'tideline-ibuild4you',
})
const db = getFirestore(app)

const store: RecorderStore = {
  async accountDocs() {
    return (await db.collection('users').get()).docs.map((d) => d.data())
  },
  async places() {
    return (await db.collection('history').get()).docs.map(
      (d) => d.data() as PlaceDoc,
    )
  },
  async writePlace(id, doc) {
    await db.doc(`history/${id}`).set({ ...doc })
  },
  async writeIssued(id, doc) {
    await db.doc(`history/${id}/issued/${doc.issuedAt}`).set({ ...doc })
  },
  async writeObserved(id, doc) {
    await db.doc(`history/${id}/observed/${doc.date}`).set({ ...doc })
  },
}

const net: RecorderFetch = {
  stations: fetchStations,
  forecast: fetchForecast,
  observations: fetchObservations,
}

const result = await recordOnce(store, net, Date.now())
for (const id of result.recorded) console.log(`recorded ${id}`)
for (const failure of result.failed) {
  console.log(`failed ${failure.id}: ${failure.error}`)
}
process.exit(result.recorded.length === 0 && result.failed.length > 0 ? 1 : 0)
