import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Written into the bundle as it is built, and read in `src/build.ts`: when
  // that was, and on Vercel the commit it was built from. The dev server's
  // time is when it started.
  define: {
    __BUILT_AT__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? ''),
  },
  build: {
    rolldownOptions: {
      output: {
        // The SDK's chunks are named, so a build log and a check can see
        // whether the page loaded them. Firestore is a chunk of its own,
        // before the `firebase` group so that group does not take it, and
        // loads only once a signed-in user's spots are wanted, so the first
        // sign-in tap downloads auth alone. Rolldown has no object form of
        // `manualChunks`; a `codeSplitting` group is its equivalent.
        codeSplitting: {
          groups: [
            {
              name: 'firestore',
              test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore)[\\/]/,
            },
            {
              name: 'firebase',
              test: /node_modules[\\/](@firebase|firebase)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    // `vercel.json`'s rewrite for the dev server, so `localhost:5173` is
    // same-site for the sign-in handler, as the live host is.
    proxy: {
      '/__/auth': {
        target: 'https://tideline-ibuild4you.firebaseapp.com',
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Run every test as if the device were in Tokyo. Nothing in this app may
    // depend on the viewer's time zone, only on the spot's. The one line
    // that is in the viewer's zone, when the build was made, asks for it by
    // name (`deviceTimeZone` in `src/time.ts`).
    env: { TZ: 'Asia/Tokyo' },
    // Hand a `.css?raw` import the stylesheet's text, which the palette's
    // contrast test reads; without this Vitest replaces every stylesheet with
    // an empty string.
    css: true,
    // `npm run coverage`. The plain modules only: the components are checked
    // in a browser, and the fixtures and the baked station list are data.
    // Every module matched is counted, tested or not, so an untested one
    // shows as 0.
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__fixtures__/**'],
    },
  },
})
