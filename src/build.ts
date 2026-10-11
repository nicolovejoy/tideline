// When this bundle was built and from what. Vite writes both in as it
// builds: see `define` in vite.config.ts.

import type { Build } from './ui/buildStamp.ts'

declare const __BUILT_AT__: string
declare const __COMMIT__: string

export const BUILD: Build = { builtAt: __BUILT_AT__, commit: __COMMIT__ }
