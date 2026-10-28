// The app's Firebase config, from Vercel's env. Firebase's web config is not
// a secret, but it stays out of the repo so the repo carries no project ids.
// `authDomain` is the page's own host unless the env names one, so the
// sign-in handoff is same-site: WebKit partitions storage by top-level site,
// and a handler on `<project>.firebaseapp.com` cannot read the state the SDK
// wrote on our host ("missing initial state"). `vercel.json` rewrites
// `/__/auth/*` on our host back to Firebase's, and the dev server's proxy in
// `vite.config.ts` does the same.

export type FirebaseConfig = {
  apiKey: string
  projectId: string
  appId: string
  authDomain: string
}

export type FirebaseConfigResult =
  { ok: true; config: FirebaseConfig } | { ok: false; missing: string[] }

const NAMES = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export function firebaseConfig(
  env: Record<string, string | undefined>,
  host: string,
): FirebaseConfigResult {
  const missing = NAMES.filter((n) => !env[n]?.trim())
  if (missing.length) return { ok: false, missing }
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || host
  return {
    ok: true,
    config: {
      apiKey: env.VITE_FIREBASE_API_KEY!.trim(),
      projectId: env.VITE_FIREBASE_PROJECT_ID!.trim(),
      appId: env.VITE_FIREBASE_APP_ID!.trim(),
      authDomain,
    },
  }
}
