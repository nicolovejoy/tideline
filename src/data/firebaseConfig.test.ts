import { describe, expect, it } from 'vitest'
import { firebaseConfig } from './firebaseConfig.ts'

const env = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_PROJECT_ID: 'proj',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
}

describe('firebaseConfig', () => {
  it('reads the three names and takes the auth domain from the page host', () => {
    expect(firebaseConfig(env, 'tideline-spike.vercel.app')).toEqual({
      ok: true,
      config: {
        apiKey: 'key',
        projectId: 'proj',
        appId: '1:2:web:3',
        authDomain: 'tideline-spike.vercel.app',
      },
    })
  })

  it('lets VITE_FIREBASE_AUTH_DOMAIN override the host', () => {
    const r = firebaseConfig(
      { ...env, VITE_FIREBASE_AUTH_DOMAIN: ' tideline.ibuild4you.com ' },
      'localhost:5173',
    )
    expect(r.ok && r.config.authDomain).toBe('tideline.ibuild4you.com')
  })

  it('names every missing variable', () => {
    expect(firebaseConfig({ VITE_FIREBASE_API_KEY: 'key' }, 'h')).toEqual({
      ok: false,
      missing: ['VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'],
    })
  })
})
